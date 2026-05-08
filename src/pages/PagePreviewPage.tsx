import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Page } from '../../shared/types/pages';
import { fetchPreviewPageById } from '../services/publicContent';
import { DynamicPage } from './DynamicPage';

export function PagePreviewPage() {
  const { id } = useParams();
  const [page, setPage] = useState<Page | null>(null);
  const [status, setStatus] = useState('正在加载页面预览...');

  useEffect(() => {
    if (!id) {
      setStatus('缺少页面 ID。');
      return;
    }

    setStatus('正在加载页面预览...');
    fetchPreviewPageById(id)
      .then((nextPage) => {
        if (!nextPage) {
          setStatus('没有找到可预览的页面。');
          return;
        }

        setPage(nextPage);
        setStatus('');
      })
      .catch(() => {
        setStatus('页面预览加载失败，请确认后端 dev:server 已启动。');
      });
  }, [id]);

  if (page) {
    return (
      <DynamicPage
        page={page}
        previewNotice="预览页面，尚未进入 route manifest / sitemap / HTML 发布链路"
      />
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 pt-32 text-black">
      <div className="mx-auto max-w-2xl rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
        <p className="mb-4 text-xs font-black tracking-[0.24em] text-[#7a9900]">页面预览</p>
        <h1 className="text-3xl font-black tracking-tight md:text-5xl">页面预览</h1>
        <p className="mt-5 text-lg leading-8 text-gray-500">{status}</p>
        <p className="mt-5 rounded-2xl bg-[#ccff00] px-5 py-4 text-sm font-black text-black">
          预览页面，尚未进入 route manifest / sitemap / HTML 发布链路
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex rounded-full bg-black px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800"
        >
          返回首页
        </Link>
      </div>
    </main>
  );
}
