import { type FormEvent, useState } from 'react';
import { loginAdmin, type AdminUser } from '../api/auth';

interface LoginPageProps {
  onLoginSuccess: (user: AdminUser) => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const user = await loginAdmin({ username, password });
      onLoginSuccess(user);
    } catch {
      setErrorMessage('登录失败，请检查账号或密码。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="admin-auth-screen">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <div>
          <p className="admin-eyebrow">NEED CMS</p>
          <h1>后台登录</h1>
          <p>请输入管理员账号继续。</p>
        </div>

        <label>
          <span>用户名</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label>
          <span>密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        {errorMessage ? (
          <div className="admin-login-error" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <button type="submit" disabled={isSubmitting || !username.trim() || !password}>
          {isSubmitting ? '登录中...' : '登录'}
        </button>
      </form>
    </main>
  );
}
