const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
}

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

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.message || 'Request failed');
  }

  return body.data;
}

export async function getContactInfo() {
  return readJson<ContactInfo>(await fetch(`${apiBaseUrl}/api/contact-info`));
}

export async function saveContactInfo(contactInfo: ContactInfo) {
  return readJson<ContactInfo>(await fetch(`${apiBaseUrl}/api/contact-info`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactInfo),
  }));
}

export async function getCompanyAssets() {
  return readJson<CompanyAsset[]>(await fetch(`${apiBaseUrl}/api/company-assets`));
}

export async function saveCompanyAssets(companyAssets: CompanyAsset[]) {
  return readJson<CompanyAsset[]>(await fetch(`${apiBaseUrl}/api/company-assets`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(companyAssets),
  }));
}
