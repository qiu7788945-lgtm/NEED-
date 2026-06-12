import { getJson, putJson } from './client';

export interface ContactSocial {
  id: string;
  label: string;
  displayName: string;
  value: string;
  qrImageUrl: string;
  qrImageAlt: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ContactInfo {
  companyName: string;
  brandName: string;
  address: {
    label: string;
    value: string;
    alt: string;
  };
  email: {
    label: string;
    value: string;
    enabled: boolean;
  };
  phone: {
    label: string;
    value: string;
    enabled: boolean;
  };
  socials: ContactSocial[];
}

export interface CompanyAsset {
  id: string;
  title: string;
  summary: string;
  description: string;
  location: string;
  imageUrl: string;
  imageAlt: string;
  sortOrder: number;
  enabled: boolean;
}

const errorOptions = {
  fallbackMessage: 'Request failed',
};

export async function getContactInfo() {
  return getJson<ContactInfo>('/api/contact-info', errorOptions);
}

export async function saveContactInfo(contactInfo: ContactInfo) {
  return putJson<ContactInfo>('/api/contact-info', contactInfo, errorOptions);
}

export async function getCompanyAssets() {
  return getJson<CompanyAsset[]>('/api/company-assets', errorOptions);
}

export async function saveCompanyAssets(companyAssets: CompanyAsset[]) {
  return putJson<CompanyAsset[]>('/api/company-assets', companyAssets, errorOptions);
}
