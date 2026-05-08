import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BrandingPage } from './BrandingPage';

vi.mock('../services/portalApi', () => ({
  portalApi: {
    getBranding: vi.fn(),
    saveBranding: vi.fn(),
    publishBranding: vi.fn(),
    unpublishBranding: vi.fn(),
    regenerateBrandingQrCode: vi.fn(),
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
  headerTagline: '',
  igUsername: '',
  tiktokUsername: '',
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

  it('always shows save, publish and unpublish buttons', async () => {
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeInTheDocument();
  });

  it('uses published-state availability when clean', async () => {
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeEnabled();
  });

  it('uses draft-state availability when clean', async () => {
    vi.mocked(portalApi.getBranding).mockResolvedValue({ ...baseBranding, status: 'draft', publishedAt: null } as never);
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeDisabled();
  });

  it('locks publish and unpublish while dirty and enables save', async () => {
    render(<BrandingPage />);
    fireEvent.change(await screen.findByLabelText('Business Name'), { target: { value: 'New Biz' } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeDisabled();
    expect(screen.getByText('Save changes to enable Publish/Unpublish.')).toBeInTheDocument();
  });

  it('disables all three while save is in flight', async () => {
    let resolveSave!: (value: unknown) => void;
    const pendingSave = new Promise((resolve) => {
      resolveSave = resolve;
    });
    vi.mocked(portalApi.saveBranding).mockReturnValue(pendingSave as never);
    render(<BrandingPage />);
    fireEvent.change(await screen.findByLabelText('Business Name'), { target: { value: 'New Biz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeDisabled();
    resolveSave({ ...baseBranding, updatedAt: '2026-02-01T00:00:00.000Z' });
  });

  it('clears dirty state and recalculates lifecycle availability after save', async () => {
    vi.mocked(portalApi.saveBranding).mockResolvedValue({ ...baseBranding, status: 'draft', publishedAt: null, updatedAt: '2026-02-01T00:00:00.000Z' } as never);
    render(<BrandingPage />);
    fireEvent.change(await screen.findByLabelText('Business Name'), { target: { value: 'New Biz' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Branding saved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Unpublish' })).toBeDisabled();
  });

  it('requires slug confirmation before delete call', async () => {
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Delete Profile' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Profile' }));
    expect(portalApi.deleteBranding).not.toHaveBeenCalled();
    expect(await screen.findByText('Type your workspace slug to confirm deletion.')).toBeInTheDocument();
  });

  it('shows static coach registration qr section', async () => {
    render(<BrandingPage />);
    expect(await screen.findByText('Register as a coach')).toBeInTheDocument();
    expect(screen.getByAltText('Register as a coach QR code')).toBeInTheDocument();
    expect(screen.getByText('https://best-hiit-timer-portal.vercel.app/')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Timer App' })).toBeInTheDocument();
  });

  it('enables open timer app button for published profiles', async () => {
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Open Timer App' })).toBeEnabled();
  });

  it('disables open timer app button for draft profiles', async () => {
    vi.mocked(portalApi.getBranding).mockResolvedValue({ ...baseBranding, status: 'draft', publishedAt: null } as never);
    render(<BrandingPage />);
    expect(await screen.findByRole('button', { name: 'Open Timer App' })).toBeDisabled();
  });

  it('opens timer app in a new tab using the current slug', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<BrandingPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Timer App' }));
    expect(openSpy).toHaveBeenCalledWith('https://best-hiit-timer.vercel.app/slug-one', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('shows uploaded image previews above upload controls', async () => {
    vi.mocked(portalApi.getBranding).mockResolvedValue({
      ...baseBranding,
      logoUrl: 'https://blob.vercel-storage.com/tenants/w1/branding/logo.png',
      coachPhotoUrl: 'https://blob.vercel-storage.com/tenants/w1/branding/coach.png',
      coachHeaderImageUrl: 'https://blob.vercel-storage.com/tenants/w1/branding/header.png',
    } as never);
    render(<BrandingPage />);

    expect(await screen.findByAltText('Uploaded logo preview')).toBeInTheDocument();
    expect(screen.getByAltText('Uploaded coach photo preview')).toBeInTheDocument();
    expect(screen.getByAltText('Uploaded coach header preview')).toBeInTheDocument();
  });
});
