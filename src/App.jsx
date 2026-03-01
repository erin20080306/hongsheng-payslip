import { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { User, ShieldCheck, ArrowRight, Sparkles, ArrowLeft, Download, LogOut, Wallet, CalendarCheck, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

const API_BASE = '';

function App() {
  const [step, setStep] = useState('login'); // login, menu, options, payslip, classes, admin
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [payslipData, setPayslipData] = useState(null);
  const [classesData, setClassesData] = useState(null);
  const [isFocused, setIsFocused] = useState('');
  const payslipRef = useRef(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [savePreviewUrl, setSavePreviewUrl] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [expandedDates, setExpandedDates] = useState({});
  const [expandedClasses, setExpandedClasses] = useState({});

  useEffect(() => {
    // 自動檢查更新
    const checkForUpdates = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          // 檢查是否有新版本
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'activated') {
                  window.location.reload();
                }
              });
            }
          });
          // 強制檢查更新
          await registration.update();
        } catch (err) {
          console.error('SW registration failed:', err);
        }
      }
    };
    checkForUpdates();
  }, []);

  // 背景預先載入資料（不阻塞 UI）
  const prefetchData = async (userName) => {
    try {
      // 同時預先載入薪資選項和報班資料
      const [optionsRes, classesRes] = await Promise.all([
        fetch(`${API_BASE}/api/options`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: userName }),
        }),
        fetch(`${API_BASE}/api/classes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: userName }),
        }),
      ]);
      
      const [optionsData, classesData] = await Promise.all([
        optionsRes.json(),
        classesRes.json(),
      ]);
      
      // 預先設置資料（如果有的話）
      if (optionsData.keys?.length > 0) {
        setOptions(optionsData);
        
        // 如果只有一個薪資單，預先載入薪資單內容
        if (optionsData.keys.length === 1 && optionsData.keys[0].dates.length === 1) {
          const aKey = optionsData.keys[0].aKey;
          const sheetTitle = optionsData.keys[0].dates[0];
          const payslipRes = await fetch(`${API_BASE}/api/payslip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ aKey, sheetTitle, name: userName }),
          });
          const payslipData = await payslipRes.json();
          if (!payslipData.error) {
            setPayslipData(payslipData);
            setSelectedKey({ aKey, sheetTitle });
          }
        }
      }
      if (classesData.results?.length > 0 || classesData.data?.length > 0) {
        setClassesData(classesData.results || classesData.data);
      }
    } catch (err) {
      // 預載入失敗不影響使用者體驗，靜默處理
      console.log('Prefetch failed:', err);
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    
    const trimmedName = (name || '').trim();
    const trimmedId = (idNumber || '').trim();
    
    console.log('handleVerify called', { name, idNumber, trimmedName, trimmedId });
    
    // 手動驗證
    if (!trimmedName || !trimmedId) {
      setError(`請輸入姓名與身分證號 (name=${trimmedName}, id=${trimmedId})`);
      return;
    }
    
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: trimmedName, idNumber: trimmedId }),
      });
      const data = await res.json();

      if (data.ok) {
        if (data.isAdmin) {
          setIsAdmin(true);
          setStep('admin');
        } else {
          setStep('menu');
          // 背景預先載入薪資選項和報班資料
          prefetchData(trimmedName);
        }
      } else {
        setError(data.error || '驗證失敗');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const fetchOptions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();

      if (data.error && data.keys?.length === 0) {
        setError(data.error);
      } else if (data.keys?.length > 0) {
        setOptions(data);
        if (data.keys.length === 1 && data.keys[0].dates.length === 1) {
          await fetchPayslip(data.keys[0].aKey, data.keys[0].dates[0]);
        } else {
          setStep('options');
        }
      } else {
        setError('找不到薪資資料');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayslip = async (aKey, sheetTitle) => {
    setLoading(true);
    setError('');
    setSelectedKey({ aKey, sheetTitle });
    try {
      const res = await fetch(`${API_BASE}/api/payslip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ aKey, sheetTitle, name: name.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setPayslipData(data);
        setSelectedKey({ aKey, sheetTitle });
        setStep('payslip');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 判斷是否為行動裝置
  const isMobileDevice = () => {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0);
  };

  const handleDownloadPng = async () => {
    if (!payslipRef.current) return;
    setIsDownloading(true);
    try {
      const dataUrl = await toPng(payslipRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
        style: { margin: 0, padding: '32px' },
      });
      
      const filename = `薪資單_${selectedKey?.sheetTitle || 'payslip'}.png`;
      const isMobile = isMobileDevice();

      if (isMobile) {
        // === 手機：絕對不用 <a download>，iOS 會跳離 PWA ===
        // 將 dataUrl 轉換為 Blob
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: 'image/png' });

        // 嘗試 Web Share API
        let shared = false;
        try {
          if (navigator.share && navigator.canShare) {
            const file = new File([blob], filename, { type: 'image/png' });
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: filename });
              shared = true;
            }
          }
        } catch (shareErr) {
          // 用戶取消分享 → 留在原頁面
          if (shareErr.name === 'AbortError') {
            shared = true; // 視為已處理，不再走其他路徑
          }
          console.log('Share:', shareErr.name);
        }

        if (!shared) {
          // 手機無 Share API → 顯示圖片在 app 內，讓用戶長按儲存
          setSavePreviewUrl(dataUrl);
        }
      } else {
        // === 電腦：使用 <a download>，安全無問題 ===
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => document.body.removeChild(link), 300);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('下載失敗，請截圖保存');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBack = () => {
    if (step === 'payslip') {
      setStep('options');
      setPayslipData(null);
    } else if (step === 'options') {
      setStep(isAdmin ? 'admin' : 'menu');
      setOptions(null);
    } else if (step === 'classes') {
      setStep(isAdmin ? 'admin' : 'menu');
      setClassesData(null);
    } else if (step === 'menu') {
      setStep('login');
    } else if (step === 'admin') {
      setStep('login');
      setIsAdmin(false);
    }
    setError('');
  };

  const handleLogout = () => {
    setStep('login');
    setName('');
    setIdNumber('');
    setOptions(null);
    setPayslipData(null);
    setClassesData(null);
    setSelectedKey(null);
    setError('');
    setIsAdmin(false);
    setSearchName('');
  };

  // 管理者查詢報班
  const handleAdminSearchClasses = async () => {
    if (!searchName.trim()) {
      setError('請輸入要查詢的姓名');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: searchName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setClassesData(data.results || data.data);
        setStep('classes');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 管理者查詢薪資
  const handleAdminSearchPayslip = async () => {
    if (!searchName.trim()) {
      setError('請輸入要查詢的姓名');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: searchName.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setOptions(data);
        // 管理者查詢時，將 searchName 設為當前查詢的姓名
        setName(searchName.trim());
        setStep('options');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    // 清除 Service Worker 快取並重新載入
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
    // 清除所有快取
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        await caches.delete(name);
      }
    }
    // 強制重新載入
    window.location.reload(true);
  };

  const handleGoToPayslip = async () => {
    setLoading(true);
    setError('');
    // 如果已經預載入了資料，直接使用
    if (options?.keys?.length > 0) {
      if (options.keys.length === 1 && options.keys[0].dates.length === 1) {
        // 如果薪資單內容也已預載入，直接顯示
        if (payslipData) {
          setLoading(false);
          setStep('payslip');
          return;
        }
        await fetchPayslip(options.keys[0].aKey, options.keys[0].dates[0]);
      } else {
        setLoading(false);
        setStep('options');
      }
      return;
    }
    await fetchOptions();
  };

  const handleGoToClasses = async () => {
    setLoading(true);
    setError('');
    // 如果已經預載入了資料，直接使用
    if (classesData?.length > 0) {
      setLoading(false);
      setStep('classes');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setClassesData(data.results || data.data);
        setStep('classes');
      }
    } catch (err) {
      setError('網路錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* 時尚裝飾背景 */}
      <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-50 rounded-full blur-[100px] opacity-60"></div>
      <div className="absolute bottom-[-5%] left-[-5%] w-[300px] h-[300px] bg-indigo-50 rounded-full blur-[80px] opacity-60"></div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* 標誌區域 */}
        <div className="mb-12 text-center group no-print">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-blue-600 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative w-20 h-20 bg-white rounded-[24px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] flex items-center justify-center mb-6 border border-slate-50 transition-transform duration-500 group-hover:rotate-[10deg]">
              <span className="text-blue-600 text-4xl font-black italic">H</span>
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-[0.2em] mb-2 pl-[0.2em]">宏盛查詢</h1>
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] w-8 bg-slate-200"></div>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em]">Smart Management</p>
            <div className="h-[1px] w-8 bg-slate-200"></div>
          </div>
          {/* 重新整理按鈕 */}
          <button
            onClick={handleRefresh}
            className="mt-4 flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 text-sm transition-colors"
          >
            <RefreshCw size={14} />
            <span>重新整理</span>
          </button>
        </div>

        {/* 錯誤訊息 */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium text-center">
            {error}
          </div>
        )}

        {/* 登入表單 */}
        {step === 'login' && (
          <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
            <form onSubmit={handleVerify} className="space-y-12">
              {/* 姓名輸入 */}
              <div className="relative">
                <label className={`absolute left-0 -top-6 text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${isFocused === 'name' ? 'text-blue-600' : 'text-slate-400'}`}>
                  Full Name / 姓名
                </label>
                <div className="relative flex items-center">
                  <User size={24} className={`absolute left-0 transition-colors ${isFocused === 'name' ? 'text-blue-600' : 'text-slate-300'}`} />
                  <input
                    type="text"
                    inputMode="text"
                    placeholder="請輸入姓名"
                    onFocus={() => setIsFocused('name')}
                    onBlur={() => setIsFocused('')}
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-b-2 border-slate-100 focus:border-blue-600 outline-none transition-all duration-300 placeholder:text-slate-200 text-slate-800 font-black text-2xl"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>
              </div>

              {/* 身分證號輸入 */}
              <div className="relative">
                <label className={`absolute left-0 -top-6 text-[10px] font-black tracking-[0.2em] uppercase transition-colors ${isFocused === 'id' ? 'text-blue-600' : 'text-slate-400'}`}>
                  ID Number / 身分證號
                </label>
                <div className="relative flex items-center">
                  <ShieldCheck size={24} className={`absolute left-0 transition-colors ${isFocused === 'id' ? 'text-blue-600' : 'text-slate-300'}`} />
                  <input
                    type="text"
                    inputMode="text"
                    placeholder="請輸入身分證"
                    onFocus={() => setIsFocused('id')}
                    onBlur={() => setIsFocused('')}
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-b-2 border-slate-100 focus:border-blue-600 outline-none transition-all duration-300 placeholder:text-slate-200 text-slate-800 font-black text-2xl tracking-[0.1em]"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    maxLength={10}
                  />
                </div>
              </div>

              {/* 提交按鈕 */}
              <button
                type="submit"
                disabled={loading}
                className="w-full group relative overflow-hidden bg-slate-900 rounded-2xl py-5 transition-all duration-500 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                <div className="flex items-center justify-center gap-3 relative z-10">
                  <span className="text-white font-bold tracking-[0.4em] pl-[0.4em]">{loading ? '驗證中...' : '登入'}</span>
                  <ArrowRight size={18} className="text-blue-400 group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </button>
            </form>

            <div className="mt-8 flex justify-center">
              <button className="text-[10px] font-bold text-slate-300 hover:text-blue-600 transition-colors flex items-center gap-1 uppercase tracking-tighter">
                <Sparkles size={12} />
                智慧辨識系統啟動中
              </button>
            </div>
          </div>
        )}

        {/* 管理者介面 */}
        {step === 'admin' && (
          <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
            <h2 className="text-2xl font-black text-slate-900 tracking-[0.1em] mb-2 text-center">管理者查詢</h2>
            <p className="text-slate-400 text-sm font-medium text-center mb-8">輸入員工姓名進行查詢</p>
            
            <div className="mb-6">
              <div className="relative flex items-center">
                <User size={24} className="absolute left-0 text-slate-300" />
                <input
                  type="text"
                  placeholder="請輸入員工姓名"
                  className="w-full pl-10 pr-4 py-3 bg-transparent border-b-2 border-slate-100 focus:border-blue-600 outline-none transition-all duration-300 placeholder:text-slate-300 text-slate-800 font-bold text-xl"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={handleAdminSearchPayslip}
                disabled={loading}
                className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl font-bold text-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 group"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center">
                  <Wallet size={24} className="text-blue-600 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg">查詢薪資</div>
                  <div className="text-sm opacity-60 font-normal">查看員工薪資單</div>
                </div>
                <ArrowRight size={20} className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={handleAdminSearchClasses}
                disabled={loading}
                className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-green-600 hover:text-white rounded-2xl font-bold text-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 group"
              >
                <div className="w-12 h-12 bg-green-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center">
                  <CalendarCheck size={24} className="text-green-600 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg">查詢報班</div>
                  <div className="text-sm opacity-60 font-normal">查看員工報班紀錄</div>
                </div>
                <ArrowRight size={20} className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="mt-8 w-full flex items-center justify-center gap-2 py-4 border-2 border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-red-400 hover:text-red-500 transition-all"
            >
              <LogOut size={18} />
              <span className="tracking-wider">登出</span>
            </button>
          </div>
        )}

        {/* 功能選單 */}
        {step === 'menu' && (
          <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
            <h2 className="text-2xl font-black text-slate-900 tracking-[0.1em] mb-2 text-center">歡迎回來</h2>
            <p className="text-slate-400 text-sm font-medium text-center mb-8">{name}</p>
            
            <div className="space-y-4">
              <button
                onClick={handleGoToPayslip}
                disabled={loading}
                className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-2xl font-bold text-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 group"
              >
                <div className="w-12 h-12 bg-blue-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center">
                  <Wallet size={24} className="text-blue-600 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg">{loading ? '查詢中...' : '薪資查詢'}</div>
                  <div className="text-sm opacity-60 font-normal">{loading ? '請稍候' : '查看您的薪資單'}</div>
                </div>
                <ArrowRight size={20} className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>

              <button
                onClick={handleGoToClasses}
                disabled={loading}
                className="w-full flex items-center gap-4 p-5 bg-slate-50 hover:bg-green-600 hover:text-white rounded-2xl font-bold text-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 group"
              >
                <div className="w-12 h-12 bg-green-100 group-hover:bg-white/20 rounded-xl flex items-center justify-center">
                  <CalendarCheck size={24} className="text-green-600 group-hover:text-white" />
                </div>
                <div className="text-left">
                  <div className="text-lg">{loading ? '查詢中...' : '報班查詢'}</div>
                  <div className="text-sm opacity-60 font-normal">{loading ? '請稍候' : '臨工查詢 / 查看報班紀錄'}</div>
                </div>
                <ArrowRight size={20} className="ml-auto opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="mt-8 w-full flex items-center justify-center gap-2 py-4 border-2 border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-red-400 hover:text-red-500 transition-all"
            >
              <LogOut size={18} />
              <span className="tracking-wider">登出</span>
            </button>
          </div>
        )}

        {/* 選擇薪資單 */}
        {step === 'options' && options && (
          <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 mb-6 text-slate-500 hover:text-blue-600 font-bold transition-colors"
            >
              <ArrowLeft size={18} />
              <span>返回</span>
            </button>
            
            <h2 className="text-2xl font-black text-slate-900 tracking-[0.1em] mb-2 text-center">選擇薪資單</h2>
            <p className="text-slate-400 text-sm font-medium text-center mb-2">員工：{name}</p>
            <p className="text-blue-600 text-base font-bold text-center mb-8">👆 點選要查詢的薪資日期</p>
            
            {(options?.keys || []).map((opt) => {
              const isExpanded = expandedDates[opt.aKey] || false;
              const visibleDates = isExpanded ? opt.dates : opt.dates.slice(0, 6);
              const hasMore = opt.dates.length > 6;
              
              return (
                <div key={opt.aKey} className="mb-6">
                  {(options?.keys || []).length > 1 && (
                    <h3 className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 mb-3">識別碼：{opt.aKey}</h3>
                  )}
                  <p className="text-sm text-slate-500 mb-3">共 {opt.dates.length} 筆薪資單</p>
                  <div className="grid grid-cols-3 gap-3">
                    {visibleDates.map((date) => {
                      const displayText = date.replace(/^[BD]:/, '').replace(/:\d+$/, '');
                      const isLong = displayText.length > 8;
                      return (
                        <button
                          key={date}
                          onClick={() => fetchPayslip(opt.aKey, date)}
                          disabled={loading}
                          className={`py-3 px-2 bg-[#d4e5f7] hover:bg-[#b8d4f0] text-slate-700 rounded-xl font-bold transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 text-center ${isLong ? 'text-xs' : 'text-sm'}`}
                        >
                          {loading && selectedKey?.sheetTitle === date ? '查詢中...' : displayText}
                        </button>
                      );
                    })}
                  </div>
                  {hasMore && (
                    <button
                      onClick={() => setExpandedDates(prev => ({ ...prev, [opt.aKey]: !isExpanded }))}
                      className="mt-4 text-blue-600 font-bold text-sm hover:text-blue-800 transition-colors"
                    >
                      {isExpanded ? '收合 ▲' : `展開全部 (${opt.dates.length - 6} 筆更多) ▼`}
                    </button>
                  )}
                </div>
              );
            })}

            <button
              onClick={handleLogout}
              className="mt-6 w-full flex items-center justify-center gap-2 py-4 border-2 border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-red-400 hover:text-red-500 transition-all"
            >
              <LogOut size={18} />
              <span className="tracking-wider">登出</span>
            </button>
          </div>
        )}

        {/* 薪資單顯示 */}
        {step === 'payslip' && payslipData && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
            {/* 操作按鈕 */}
            <div className="p-6 border-b border-slate-100 flex flex-wrap gap-3 no-print">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-blue-600 font-bold transition-colors"
              >
                <ArrowLeft size={18} />
                <span>返回</span>
              </button>
              <div className="flex-1"></div>
              <button
                onClick={handleDownloadPng}
                disabled={isDownloading}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-blue-600 rounded-xl font-bold text-white transition-all disabled:opacity-50"
              >
                <Download size={18} />
                <span>{isDownloading ? '處理中...' : '下載'}</span>
              </button>
            </div>

            {/* 薪資單內容 */}
            <div ref={payslipRef} className="p-8 bg-white">
              <div className="text-center mb-6 pb-5 border-b-[3px] border-slate-800">
                <h2 className="text-2xl font-black text-slate-900 tracking-[0.15em] mb-1">
                  {payslipData.isWeeklyPayslip ? '宏盛週領薪資單' : '宏盛薪資單'}
                </h2>
                <p className="text-slate-500 text-base font-bold">日期：{payslipData.sheetTitle.replace(/^[BD]:/, '').replace(/:\d+$/, '')}</p>
              </div>
              <table className="w-full border-collapse border border-slate-300">
                <tbody>
                  {Object.entries(payslipData.data).map(([col, value], idx) => {
                    const header = payslipData.headers?.[col];
                    if (!value && !header) return null;
                    const isTotal = header && (header.includes('總計') || header.includes('合計') || header === '實領');
                    return (
                      <tr key={col} className={`border-b border-slate-200 ${isTotal ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}>
                        <th className="py-2.5 px-4 text-left text-sm font-bold text-slate-600 border-r border-slate-200 w-[38%]">
                          {header || `欄位 ${col}`}
                        </th>
                        <td className={`py-2.5 px-4 text-sm ${isTotal ? 'font-black text-blue-700 text-base' : value ? 'font-semibold text-slate-800' : 'text-slate-300'}`}>
                          {value || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 底部登出 */}
            <div className="p-6 border-t border-slate-100 no-print">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-red-400 hover:text-red-500 transition-all"
              >
                <LogOut size={18} />
                <span className="tracking-wider">登出</span>
              </button>
            </div>
          </div>
        )}

        {/* 報班查詢結果 */}
        {step === 'classes' && classesData && (
          <div className="bg-white/80 backdrop-blur-xl rounded-[40px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] border border-white overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3 no-print">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-blue-600 font-bold transition-colors"
              >
                <ArrowLeft size={18} />
                <span>返回</span>
              </button>
              <h2 className="text-xl font-black text-slate-900">報班紀錄</h2>
            </div>

            <div className="p-6 space-y-6">
              {classesData.map((sheet, idx) => {
                const isExpanded = expandedClasses[idx] || false;
                const registeredCount = sheet.registrations?.filter(r => r.registered).length || 0;
                const visibleRegs = isExpanded ? sheet.registrations : sheet.registrations?.slice(0, 10);
                const hasMore = (sheet.registrations?.length || 0) > 10;
                
                return (
                <div key={idx} className="bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <CalendarCheck size={20} className="text-green-600" />
                    {sheet.sheetName}
                    {sheet.warehouse && (
                      <span className="ml-2 px-3 py-1 bg-orange-100 text-orange-700 text-sm font-bold rounded-full">
                        {sheet.warehouse}
                      </span>
                    )}
                  </h3>
                  
                  <p className="text-sm text-slate-500 mb-3">共 {sheet.registrations?.length || 0} 天，已報 {registeredCount} 天</p>
                  
                  {/* E-J 欄資訊（S 前綴） */}
                  {sheet.info && sheet.info.length > 0 && (
                    <div className="mb-4 p-4 bg-blue-50 rounded-xl">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        {sheet.info.map((item, i) => (
                          <div key={i} className="text-center">
                            <div className="text-slate-400 text-xs mb-1">{item.label.replace(/\n/g, ' ')}</div>
                            <div className="font-bold text-slate-800">{item.value || '-'}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* 日期報班格式顯示 */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {visibleRegs?.map((reg, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl text-center ${
                          reg.registered
                            ? 'bg-green-100 border-2 border-green-400'
                            : 'bg-slate-100 border border-slate-200'
                        }`}
                      >
                        <div className="text-sm font-bold text-slate-700">{reg.date}</div>
                        <div className="mt-1">
                          {reg.registered ? (
                            <CheckCircle size={20} className="mx-auto text-green-600" />
                          ) : (
                            <XCircle size={20} className="mx-auto text-slate-300" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {hasMore && (
                    <button
                      onClick={() => setExpandedClasses(prev => ({ ...prev, [idx]: !isExpanded }))}
                      className="mt-4 text-blue-600 font-bold text-sm hover:text-blue-800 transition-colors"
                    >
                      {isExpanded ? '收合 ▲' : `展開全部 (${(sheet.registrations?.length || 0) - 10} 天更多) ▼`}
                    </button>
                  )}
                </div>
              );
              })}
            </div>

            <div className="p-6 border-t border-slate-100 no-print">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-4 border-2 border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-red-400 hover:text-red-500 transition-all"
              >
                <LogOut size={18} />
                <span className="tracking-wider">登出</span>
              </button>
            </div>
          </div>
        )}

        {/* 底部頁尾 */}
        <p className="mt-12 text-center text-[10px] font-bold text-slate-300 tracking-[0.5em] uppercase pl-[0.5em] no-print">
          HONG SHENG Premium Service
        </p>
      </div>

      {/* 手機長按儲存圖片 overlay */}
      {savePreviewUrl && (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full max-h-[85vh] overflow-auto">
            <p className="text-center text-sm font-bold text-slate-700 mb-3">📱 長按圖片即可儲存</p>
            <img src={savePreviewUrl} alt="薪資單" className="w-full rounded-lg" />
            <button
              onClick={() => setSavePreviewUrl(null)}
              className="mt-4 w-full py-3 bg-slate-900 text-white font-bold rounded-xl"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && step !== 'login' && !isDownloading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-lg font-bold text-slate-700">查詢中...</p>
          <p className="text-sm text-slate-500">請稍候</p>
        </div>
      )}
    </div>
  );
}

export default App;
