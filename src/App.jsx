import { useState, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { User, ShieldCheck, ArrowRight, Sparkles, ArrowLeft, Printer, Download, LogOut, Wallet, CalendarCheck, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = '';

function App() {
  const [step, setStep] = useState('login'); // login, menu, options, payslip, classes
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

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ name: name.trim(), idNumber: idNumber.trim() }),
      });
      const data = await res.json();

      if (data.ok) {
        setStep('menu');
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
        setOptions(data.keys);
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPng = async () => {
    if (!payslipRef.current) return;
    setLoading(true);
    try {
      const dataUrl = await toPng(payslipRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `薪資單_${selectedKey?.sheetTitle || 'payslip'}.png`;
      link.href = dataUrl;
      
      if (navigator.userAgent.match(/Android/i) && !('download' in link)) {
        const img = new Image();
        img.src = dataUrl;
        const w = window.open('');
        w.document.write('<p>長按圖片另存新檔</p>');
        w.document.body.appendChild(img);
      } else {
        link.click();
      }
    } catch (err) {
      alert('下載失敗，請嘗試使用列印功能');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'payslip') {
      setStep('options');
      setPayslipData(null);
    } else if (step === 'options') {
      setStep('menu');
      setOptions(null);
    } else if (step === 'classes') {
      setStep('menu');
      setClassesData(null);
    } else if (step === 'menu') {
      setStep('login');
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
  };

  const handleGoToPayslip = async () => {
    await fetchOptions();
  };

  const handleGoToClasses = async () => {
    setLoading(true);
    setError('');
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
        setClassesData(data.data);
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
                    placeholder="請輸入姓名"
                    onFocus={() => setIsFocused('name')}
                    onBlur={() => setIsFocused('')}
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-b-2 border-slate-100 focus:border-blue-600 outline-none transition-all duration-300 placeholder:text-slate-200 text-slate-800 font-black text-2xl"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
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
                    type="password"
                    placeholder="請輸入身分證"
                    onFocus={() => setIsFocused('id')}
                    onBlur={() => setIsFocused('')}
                    className="w-full pl-10 pr-4 py-3 bg-transparent border-b-2 border-slate-100 focus:border-blue-600 outline-none transition-all duration-300 placeholder:text-slate-200 text-slate-800 font-black text-2xl tracking-[0.1em]"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                    required
                    autoComplete="off"
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
                  <div className="text-lg">薪資查詢</div>
                  <div className="text-sm opacity-60 font-normal">查看您的薪資單</div>
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
                  <div className="text-lg">報班查詢</div>
                  <div className="text-sm opacity-60 font-normal">查看報班紀錄</div>
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
            <h2 className="text-2xl font-black text-slate-900 tracking-[0.1em] mb-2 text-center">選擇薪資單</h2>
            <p className="text-slate-400 text-sm font-medium text-center mb-8">員工：{name}</p>
            
            {options.map((opt) => (
              <div key={opt.aKey} className="mb-6">
                {options.length > 1 && (
                  <h3 className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-400 mb-3">識別碼：{opt.aKey}</h3>
                )}
                <div className="flex flex-wrap gap-3">
                  {opt.dates.map((date) => (
                    <button
                      key={date}
                      onClick={() => fetchPayslip(opt.aKey, date)}
                      disabled={loading}
                      className="px-6 py-3 bg-slate-50 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg disabled:opacity-50"
                    >
                      {date}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleLogout}
              className="mt-6 w-full flex items-center justify-center gap-2 py-4 border-2 border-slate-100 rounded-2xl text-slate-400 font-bold hover:border-blue-600 hover:text-blue-600 transition-all"
            >
              <LogOut size={18} />
              <span className="tracking-wider">重新登入</span>
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
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl font-bold text-slate-700 transition-all"
              >
                <Printer size={18} />
                <span>列印</span>
              </button>
              <button
                onClick={handleDownloadPng}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-blue-600 rounded-xl font-bold text-white transition-all disabled:opacity-50"
              >
                <Download size={18} />
                <span>{loading ? '處理中...' : '下載'}</span>
              </button>
            </div>

            {/* 薪資單內容 */}
            <div ref={payslipRef} className="p-8 bg-white">
              <div className="text-center mb-8 pb-6 border-b-2 border-blue-600">
                <h2 className="text-2xl font-black text-slate-900 tracking-[0.1em] mb-1">宏盛薪資單</h2>
                <p className="text-slate-400 text-sm">日期分頁：{payslipData.sheetTitle}</p>
              </div>
              <table className="w-full">
                <tbody>
                  {Object.entries(payslipData.data).map(([col, value]) => {
                    const header = payslipData.headers?.[col];
                    if (!value && !header) return null;
                    return (
                      <tr key={col} className="border-b border-slate-50">
                        <th className="py-3 px-4 text-left text-sm font-bold text-slate-500 bg-slate-50/50 w-[40%]">
                          {header || `欄位 ${col}`}
                        </th>
                        <td className="py-3 px-4 text-slate-800 font-medium">
                          {value}
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
              {classesData.map((sheet, idx) => (
                <div key={idx} className="bg-slate-50 rounded-2xl p-5">
                  <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <CalendarCheck size={20} className="text-green-600" />
                    {sheet.sheetName}
                  </h3>
                  
                  {/* 日期報班格式顯示 */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {sheet.registrations?.map((reg, i) => (
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
                  
                  <p className="mt-3 text-sm text-slate-500">
                    已報名：{sheet.registrations?.filter(r => r.registered).length || 0} 天
                  </p>
                </div>
              ))}
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

      {/* Loading overlay */}
      {loading && step !== 'login' && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}

export default App;
