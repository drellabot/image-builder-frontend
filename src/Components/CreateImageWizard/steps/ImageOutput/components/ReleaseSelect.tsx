import React, { ReactElement, useEffect, useState } from 'react';

import {
  FormGroup,
  MenuToggle,
  MenuToggleElement,
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core';

import {
  ON_PREM_RELEASES,
  RELEASES,
  RHEL_10,
  RHEL_10_FULL_SUPPORT,
  RHEL_10_MAINTENANCE_SUPPORT,
  RHEL_8,
  RHEL_8_FULL_SUPPORT,
  RHEL_8_MAINTENANCE_SUPPORT,
  RHEL_9,
  RHEL_9_FULL_SUPPORT,
  RHEL_9_MAINTENANCE_SUPPORT,
} from '@/constants';
import { Distributions } from '@/store/api/backend';
import {
  ApiRepositoryParameterResponse,
  useListRepositoryParametersQuery,
} from '@/store/api/contentSources';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { selectIsOnPremise } from '@/store/slices/env';
import {
  changeDistribution,
  changeRegistrationType,
  selectArchitecture,
  selectDistribution,
  selectExtendedReleaseStream,
} from '@/store/slices/wizard';
import isRhel from '@/Utilities/isRhel';
import { toMonthAndYear } from '@/Utilities/time';

type ReleaseOption = {
  value: string;
  label: string;
};

export function buildMinorReleaseOptions(
  selectedStream: string,
  arch: string,
  repoParams: ApiRepositoryParameterResponse | undefined,
): ReleaseOption[] {
  const options: ReleaseOption[] = [];

  if (!repoParams?.distribution_minor_versions) {
    return options;
  }

  repoParams.distribution_minor_versions.forEach((minor) => {
    if (!minor.extended_release_streams?.includes(selectedStream)) {
      return;
    }

    const streamDef = repoParams.extended_release_streams?.find(
      (s) => s.label === selectedStream,
    );
    const archEntitlement = streamDef?.architectures?.find(
      (a) => a.label === arch,
    );

    if (archEntitlement?.entitled) {
      const label = minor.label ?? '';
      options.push({
        value: `rhel-${label.replace('.', '')}`,
        label: minor.name ?? `RHEL ${label}`,
      });
    }
  });

  return options;
}

const ReleaseSelect = () => {
  const distribution = useAppSelector(selectDistribution);
  const dispatch = useAppDispatch();
  const [isOpen, setIsOpen] = useState(false);
  const [showDevelopmentOptions, setShowDevelopmentOptions] = useState(false);
  const isOnPremise = useAppSelector(selectIsOnPremise);
  const selectedStream = useAppSelector(selectExtendedReleaseStream);
  const arch = useAppSelector(selectArchitecture);

  const { data: repoParams } = useListRepositoryParametersQuery(undefined, {
    skip: isOnPremise,
  });

  const releases = isOnPremise ? ON_PREM_RELEASES : RELEASES;

  const minorReleaseOptions =
    selectedStream && !isOnPremise
      ? buildMinorReleaseOptions(selectedStream, arch, repoParams)
      : [];

  const isMinorMode = selectedStream && minorReleaseOptions.length > 0;

  useEffect(() => {
    if (!isMinorMode) return;
    const isCurrentValid = minorReleaseOptions.some(
      (o) => o.value === distribution,
    );
    if (!isCurrentValid && minorReleaseOptions.length > 0) {
      dispatch(
        changeDistribution(minorReleaseOptions[0].value as Distributions),
      );
    }
  }, [isMinorMode, selectedStream, arch]);

  const handleSelect = (
    _event?: React.MouseEvent,
    selection?: string | number,
  ) => {
    if (selection === undefined) return;
    if (selection !== ('loader' as Distributions)) {
      if (!isRhel(selection as Distributions)) {
        dispatch(changeRegistrationType('register-later'));
      } else {
        dispatch(changeRegistrationType('register-now-rhc'));
      }
      dispatch(changeDistribution(selection as Distributions));
      setIsOpen(false);
    }
  };

  const handleExpand = () => {
    setShowDevelopmentOptions(true);
  };

  const setDescription = (key: Distributions) => {
    if (isOnPremise) {
      return '';
    }

    let fullSupportEnd = '';
    let maintenanceSupportEnd = '';

    if (key === RHEL_8) {
      fullSupportEnd = toMonthAndYear(RHEL_8_FULL_SUPPORT[1]);
      maintenanceSupportEnd = toMonthAndYear(RHEL_8_MAINTENANCE_SUPPORT[1]);
    }

    if (key === RHEL_9) {
      fullSupportEnd = toMonthAndYear(RHEL_9_FULL_SUPPORT[1]);
      maintenanceSupportEnd = toMonthAndYear(RHEL_9_MAINTENANCE_SUPPORT[1]);
    }

    if (key === RHEL_10) {
      fullSupportEnd = toMonthAndYear(RHEL_10_FULL_SUPPORT[1]);
      maintenanceSupportEnd = toMonthAndYear(RHEL_10_MAINTENANCE_SUPPORT[1]);
    }

    if (isRhel(key)) {
      return `Full support ends: ${fullSupportEnd} | Maintenance support ends: ${maintenanceSupportEnd}`;
    }
  };

  const setSelectOptions = () => {
    if (isMinorMode) {
      return minorReleaseOptions.map((option) => (
        <SelectOption key={option.value} value={option.value}>
          {option.label}
        </SelectOption>
      ));
    }

    const options: ReactElement[] = [];
    const filteredRhel = new Map(
      [...releases].filter(([key]) => {
        if (isOnPremise) {
          return key === distribution;
        }

        if (showDevelopmentOptions) {
          return true;
        }
        return isRhel(key);
      }),
    );

    filteredRhel.forEach((value, key) => {
      options.push(
        <SelectOption
          key={value}
          value={key}
          description={setDescription(key as Distributions)}
        >
          {releases.get(key)}
        </SelectOption>,
      );
    });

    return options;
  };

  const getToggleLabel = (): string => {
    if (isMinorMode) {
      const match = minorReleaseOptions.find((o) => o.value === distribution);
      return match?.label ?? distribution;
    }
    return releases.get(distribution) ?? distribution;
  };

  const onToggleClick = () => {
    setIsOpen(!isOpen);
  };

  const toggle = (toggleRef: React.Ref<MenuToggleElement>) => (
    <MenuToggle
      ref={toggleRef}
      onClick={onToggleClick}
      isExpanded={isOpen}
      data-testid='release_select'
      aria-describedby='release-select-helper'
      style={
        {
          minWidth: '20rem',
          maxWidth: '100%',
        } as React.CSSProperties
      }
    >
      {getToggleLabel()}
    </MenuToggle>
  );

  return (
    <FormGroup isRequired={true} label='Release'>
      <Select
        isOpen={isOpen}
        onOpenChange={(isOpen) => setIsOpen(isOpen)}
        selected={distribution}
        onSelect={handleSelect}
        toggle={toggle}
        shouldFocusToggleOnSelect
      >
        <SelectList>
          {setSelectOptions()}
          {!isMinorMode && !showDevelopmentOptions && !isOnPremise && (
            <SelectOption
              onClick={(ev) => {
                ev.stopPropagation();
                handleExpand();
              }}
              value='loader'
              isLoadButton
            >
              Show options for further development of RHEL
            </SelectOption>
          )}
        </SelectList>
      </Select>
    </FormGroup>
  );
};

export default ReleaseSelect;
