import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrandingPage } from './BrandingPage';

vi.mock('../services/portalApi', () => ({
  portalApi: {
    getBranding: vi.fn(),
    saveBranding: vi.fn(),
    publishBranding: vi.fn(),
    unpublishBranding: vi.fn(),
    deleteBranding: vi.fn(),
    uploadAsset: vi.fn(),
    logout: vi.fn(),
  },
}));

import { portalApi } from '../services/portalApi';

const baseBranding = {
  id: 'w1',
  slug: 'slug-one',
  businessName: 'Biz',
  coachName: 'Coach',
  bio: '',
  logoUrl: '',
  coachPhotoUrl: '',
  coachHeaderImageUrl: '',
  qrCodeUrl: '',
  themePrimaryColor: '#ffffff',
  themeSecondaryColor: '#000000',
  brandHeadline: '',
  status: 'published',
  updatedAt: '2026-01-01T00:00:00.000Z',
  publishedAt: '2026-01-01T00:00:00.000Z',
  deletedAt: null,
};

describe('BrandingPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(portalApi.getBranding).mockResolvedValue(baseBranding as never);
  });

  it('shows unpublish button for published profiles', async () => {
    render(<BrandingPage />);
    expect(await screen.findByText('Unpublish')).toBeInTheDocument();
  });

  it('requires slug confirmation before delete call', async () => {
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Delete Profile' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Profile' }));
    expect(portalApi.deleteBranding).not.toHaveBeenCalled();
    expect(await screen.findByText('Type your workspace slug to confirm deletion.')).toBeInTheDocument();
  });
});
