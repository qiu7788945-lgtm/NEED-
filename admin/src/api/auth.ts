import { getJson, postJson } from './client';

export interface AdminUser {
  username: string;
  status: string;
}

interface AuthUserResponse {
  user: AdminUser;
}

export async function getCurrentAdmin() {
  const data = await getJson<AuthUserResponse>('/api/auth/me', {
    fallbackMessage: '登录状态已失效，请重新登录。',
    notifyOnUnauthorized: false,
  });

  return data.user;
}

export async function loginAdmin(credentials: { username: string; password: string }) {
  const data = await postJson<AuthUserResponse>('/api/auth/login', credentials, {
    fallbackMessage: '登录失败，请稍后再试。',
    notifyOnUnauthorized: false,
  });

  return data.user;
}

export async function logoutAdmin() {
  await postJson<null>('/api/auth/logout', undefined, {
    fallbackMessage: '退出登录失败，请稍后再试。',
  });
}
