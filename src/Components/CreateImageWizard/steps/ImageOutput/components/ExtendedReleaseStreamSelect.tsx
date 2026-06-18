import React, { useEffect, useState } from 'react';

import {
  Alert,
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
  Spinner,
} from '@patternfly/react-core';

import {
  ApiExtendedReleaseStream,
  ApiRepositoryParameterResponse,
  useListRepositoryParametersQuery,
} from '@/store/api/contentSources';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsOnPremise } from '@/store/slices/env';
import {
  changeDistribution,
  changeExtendedReleaseStream,
  selectArchitecture,
  selectDistribution,
  selectExtendedReleaseStream,
} from '@/store/slices/wizard';

type StreamOption = {
  value: string | undefined;
  label: string;
};

const STREAM_LABELS: Record<string, string> = {
  eus: 'Extended Update Support (EUS)',
  e4s: 'Update Services for SAP Solutions (E4S)',
  eeus: 'Enhanced Extended Update Support (EEUS)',
};

const NONE_VALUE = '__none__';

export function buildStreamOptions(
  arch: string,
  repoParams: ApiRepositoryParameterResponse | undefined,
): StreamOption[] {
  const options: StreamOption[] = [{ value: undefined, label: 'None' }];

  if (!repoParams?.extended_release_streams) {
    return options;
  }

  repoParams.extended_release_streams.forEach(
    (stream: ApiExtendedReleaseStream) => {
      const archEntitlement = stream.architectures?.find(
        (a) => a.label === arch,
      );

      if (archEntitlement?.entitled) {
        const streamLabel = stream.label ?? '';
        const displayName =
          stream.name || STREAM_LABELS[streamLabel] || streamLabel;
        options.push({
          value: streamLabel,
          label: displayName,
        });
      }
    },
  );

  return options;
}

export function shouldShowStreamDropdown(
  arch: string,
  repoParams: ApiRepositoryParameterResponse | undefined,
): boolean {
  const options = buildStreamOptions(arch, repoParams);
  return options.length > 1;
}

function getMajorVersion(distribution: string): string | undefined {
  if (distribution.startsWith('rhel-10')) return 'rhel-10';
  if (distribution.startsWith('rhel-9')) return 'rhel-9';
  if (distribution.startsWith('rhel-8')) return 'rhel-8';
  return undefined;
}

const ExtendedReleaseStreamSelect = () => {
  const dispatch = useAppDispatch();
  const arch = useAppSelector(selectArchitecture);
  const distribution = useAppSelector(selectDistribution);
  const selectedStream = useAppSelector(selectExtendedReleaseStream);
  const isOnPremise = useAppSelector(selectIsOnPremise);
  const [isOpen, setIsOpen] = useState(false);

  const {
    data: repoParams,
    isLoading,
    isError,
  } = useListRepositoryParametersQuery(undefined, { skip: isOnPremise });

  useEffect(() => {
    if (!selectedStream || !repoParams) return;

    const options = buildStreamOptions(arch, repoParams);
    const isStillEntitled = options.some((o) => o.value === selectedStream);
    if (!isStillEntitled) {
      dispatch(changeExtendedReleaseStream(undefined));
      const major = getMajorVersion(distribution);
      if (major && distribution !== major) {
        dispatch(changeDistribution(major as typeof distribution));
      }
    }
  }, [arch, repoParams]);

  if (isOnPremise) {
    return null;
  }

  if (isLoading) {
    return (
      <FormGroup label='Extended release stream'>
        <Spinner size='md' />
      </FormGroup>
    );
  }

  if (isError) {
    return (
      <Alert
        variant='warning'
        isInline
        isPlain
        title='Extended release stream options unavailable.'
      />
    );
  }

  const streamOptions = buildStreamOptions(arch, repoParams);

  if (!shouldShowStreamDropdown(arch, repoParams)) {
    return null;
  }

  const handleSelect = (
    _event?: React.MouseEvent,
    selection?: string | number,
  ) => {
    if (selection === undefined) return;

    const newStream = selection === NONE_VALUE ? undefined : String(selection);
    dispatch(changeExtendedReleaseStream(newStream));

    if (!newStream) {
      const major = getMajorVersion(distribution);
      if (major && distribution !== major) {
        dispatch(changeDistribution(major as typeof distribution));
      }
    }

    setIsOpen(false);
  };

  const toggleValue = selectedStream
    ? (streamOptions.find((o) => o.value === selectedStream)?.label ??
      selectedStream)
    : 'None';

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={() => setIsOpen(!isOpen)}
      isExpanded={isOpen}
      data-testid='extended_release_stream_select'
      style={
        {
          minWidth: '20rem',
          maxWidth: '100%',
        } as React.CSSProperties
      }
    >
      {toggleValue}
    </MenuToggle>
  );

  return (
    <FormGroup label='Extended release stream'>
      <Select
        isOpen={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
        selected={selectedStream ?? NONE_VALUE}
        onSelect={handleSelect}
        toggle={toggle}
        shouldFocusToggleOnSelect
      >
        <SelectList>
          {streamOptions.map((option) => (
            <SelectOption
              key={option.value ?? NONE_VALUE}
              value={option.value ?? NONE_VALUE}
            >
              {option.label}
            </SelectOption>
          ))}
        </SelectList>
      </Select>
    </FormGroup>
  );
};

export default ExtendedReleaseStreamSelect;
