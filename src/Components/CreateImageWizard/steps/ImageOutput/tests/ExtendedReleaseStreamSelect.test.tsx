import React from 'react';

import { screen, waitFor } from '@testing-library/react';

import { RHEL_10, RHEL_9 } from '@/constants';
import {
  selectDistribution,
  selectExtendedReleaseStream,
} from '@/store/slices/wizard';
import { clickWithWait, createUser, renderWithRedux } from '@/test/testUtils';

import ExtendedReleaseStreamSelect from '../components/ExtendedReleaseStreamSelect';

const mockUseListRepositoryParametersQuery = vi.fn();

vi.mock('@/store/api/contentSources', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/store/api/contentSources')>();
  return {
    ...actual,
    useListRepositoryParametersQuery: (...args: unknown[]) =>
      mockUseListRepositoryParametersQuery(...args),
  };
});

const mockRepoParams = {
  distribution_minor_versions: [
    {
      name: 'RHEL 9.4',
      label: '9.4',
      major: '9',
      extended_release_streams: ['eus', 'e4s', 'eeus'],
    },
    {
      name: 'RHEL 9.6',
      label: '9.6',
      major: '9',
      extended_release_streams: ['eus', 'e4s', 'eeus'],
    },
    {
      name: 'RHEL 9.8',
      label: '9.8',
      major: '9',
      extended_release_streams: ['eus'],
    },
  ],
  extended_release_streams: [
    {
      name: 'Extended Update Support (EUS)',
      label: 'eus',
      architectures: [
        { name: 'x86_64', label: 'x86_64', entitled: true },
        { name: 'aarch64', label: 'aarch64', entitled: true },
      ],
    },
    {
      name: 'Update Services for SAP Solutions (E4S)',
      label: 'e4s',
      architectures: [
        { name: 'x86_64', label: 'x86_64', entitled: true },
        { name: 'aarch64', label: 'aarch64', entitled: false },
      ],
    },
    {
      name: 'Enhanced Extended Update Support (EEUS)',
      label: 'eeus',
      architectures: [
        { name: 'x86_64', label: 'x86_64', entitled: true },
        { name: 'aarch64', label: 'aarch64', entitled: false },
      ],
    },
  ],
  distribution_versions: [{ name: 'RHEL 9', label: '9' }],
  distribution_arches: [
    { name: 'x86_64', label: 'x86_64' },
    { name: 'aarch64', label: 'aarch64' },
  ],
};

const renderExtendedReleaseStreamSelect = (
  wizardOverrides: Record<string, unknown> = {},
) => {
  return renderWithRedux(<ExtendedReleaseStreamSelect />, {
    distribution: RHEL_10,
    architecture: 'x86_64',
    ...wizardOverrides,
  });
};

describe('ExtendedReleaseStreamSelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseListRepositoryParametersQuery.mockReturnValue({
      data: mockRepoParams,
      isLoading: false,
      isError: false,
    });
  });

  describe('Visibility', () => {
    test('renders dropdown when user has entitlements', () => {
      renderExtendedReleaseStreamSelect();

      expect(
        screen.getByTestId('extended_release_stream_select'),
      ).toBeInTheDocument();
    });

    test('does not render when no entitlements for architecture', () => {
      mockUseListRepositoryParametersQuery.mockReturnValue({
        data: {
          ...mockRepoParams,
          extended_release_streams: [
            {
              name: 'EUS',
              label: 'eus',
              architectures: [
                { name: 'x86_64', label: 'x86_64', entitled: false },
              ],
            },
          ],
        },
        isLoading: false,
        isError: false,
      });

      renderExtendedReleaseStreamSelect();

      expect(
        screen.queryByTestId('extended_release_stream_select'),
      ).not.toBeInTheDocument();
    });

    test('does not render on-premise', () => {
      renderWithRedux(
        <ExtendedReleaseStreamSelect />,
        { distribution: RHEL_10, architecture: 'x86_64' },
        { preloadedState: { env: { isOnPremise: true } } },
      );

      expect(
        screen.queryByTestId('extended_release_stream_select'),
      ).not.toBeInTheDocument();
    });

    test('shows loading spinner when data is loading', () => {
      mockUseListRepositoryParametersQuery.mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      });

      renderExtendedReleaseStreamSelect();

      expect(screen.getByText('Extended release stream')).toBeInTheDocument();
    });

    test('shows warning on API error', () => {
      mockUseListRepositoryParametersQuery.mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      });

      renderExtendedReleaseStreamSelect();

      expect(
        screen.getByText('Extended release stream options unavailable.'),
      ).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    test('shows None as default', () => {
      renderExtendedReleaseStreamSelect();

      const toggle = screen.getByTestId('extended_release_stream_select');
      expect(toggle).toHaveTextContent('None');
    });

    test('shows entitled streams for x86_64', async () => {
      const user = createUser();
      renderExtendedReleaseStreamSelect();

      const toggle = screen.getByTestId('extended_release_stream_select');
      await clickWithWait(user, toggle);

      expect(screen.getByRole('option', { name: /None/i })).toBeInTheDocument();
      expect(
        screen.getByRole('option', {
          name: /Extended Update Support \(EUS\)/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', {
          name: /Update Services for SAP Solutions \(E4S\)/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('option', {
          name: /Enhanced Extended Update Support \(EEUS\)/i,
        }),
      ).toBeInTheDocument();
    });

    test('selecting a stream updates Redux state', async () => {
      const user = createUser();
      const { store } = renderExtendedReleaseStreamSelect();

      const toggle = screen.getByTestId('extended_release_stream_select');
      await clickWithWait(user, toggle);

      const eusOption = screen.getByRole('option', {
        name: /Extended Update Support \(EUS\)/i,
      });
      await clickWithWait(user, eusOption);

      expect(selectExtendedReleaseStream(store.getState())).toBe('eus');
    });

    test('selecting None clears the stream', async () => {
      const user = createUser();
      const { store } = renderExtendedReleaseStreamSelect({
        extendedReleaseStream: 'eus',
        distribution: RHEL_9,
      });

      const toggle = screen.getByTestId('extended_release_stream_select');
      await clickWithWait(user, toggle);

      const noneOption = screen.getByRole('option', { name: /None/i });
      await clickWithWait(user, noneOption);

      expect(selectExtendedReleaseStream(store.getState())).toBeUndefined();
    });

    test('closes dropdown after selection', async () => {
      const user = createUser();
      renderExtendedReleaseStreamSelect();

      const toggle = screen.getByTestId('extended_release_stream_select');
      await clickWithWait(user, toggle);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      const eusOption = screen.getByRole('option', {
        name: /Extended Update Support \(EUS\)/i,
      });
      await clickWithWait(user, eusOption);

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Architecture-based filtering', () => {
    test('shows fewer options for aarch64 with limited entitlements', async () => {
      const user = createUser();
      renderExtendedReleaseStreamSelect({ architecture: 'aarch64' });

      const toggle = screen.getByTestId('extended_release_stream_select');
      await clickWithWait(user, toggle);

      expect(screen.getByRole('option', { name: /None/i })).toBeInTheDocument();
      expect(
        screen.getByRole('option', {
          name: /Extended Update Support \(EUS\)/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', {
          name: /Update Services for SAP Solutions \(E4S\)/i,
        }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {
          name: /Enhanced Extended Update Support \(EEUS\)/i,
        }),
      ).not.toBeInTheDocument();
    });
  });

  describe('Distribution reset on stream change', () => {
    test('selecting None resets minor version to major version', async () => {
      const user = createUser();
      const { store } = renderExtendedReleaseStreamSelect({
        extendedReleaseStream: 'eus',
        distribution: 'rhel-94',
      });

      const toggle = screen.getByTestId('extended_release_stream_select');
      await clickWithWait(user, toggle);

      const noneOption = screen.getByRole('option', { name: /None/i });
      await clickWithWait(user, noneOption);

      expect(selectDistribution(store.getState())).toBe(RHEL_9);
    });
  });
});
