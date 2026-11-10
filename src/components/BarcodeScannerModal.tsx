import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle, Upload, RefreshCw } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
  onTestScan?: (code: string) => void;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  onTestScan,
}: BarcodeScannerModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeCamera, setActiveCamera] = useState<string | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // Audio not supported or blocked, ignore
    }
  };

  const handleSuccessfulScan = (decodedText: string) => {
    playBeep();
    stopScanner();
    onScan(decodedText);
  };

  const startScanner = async (cameraId?: string) => {
    setCameraError(null);
    setIsScanning(false);

    try {
      // Get cameras if not already populated
      let cameraList = cameras;
      if (cameraList.length === 0) {
        const devices = await Html5Qrcode.getCameras();
        if (!devices || devices.length === 0) {
          throw new Error('Tidak ada kamera yang ditemukan pada perangkat ini.');
        }
        cameraList = devices.map(d => ({ id: d.id, label: d.label || `Kamera ${d.id}` }));
        setCameras(cameraList);
      }

      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
        } catch {
          // ignore
        }
      }

      const readerElement = document.getElementById('barcode-scanner-viewport');
      if (!readerElement) return;

      const html5QrCode = new Html5Qrcode('barcode-scanner-viewport', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const targetCamera = cameraId || (cameraList.length > 0 ? cameraList[cameraList.length - 1].id : { facingMode: 'environment' });
      setActiveCamera(typeof targetCamera === 'string' ? targetCamera : null);

      await html5QrCode.start(
        targetCamera,
        {
          fps: 15,
          qrbox: { width: 260, height: 160 },
          aspectRatio: 1.333,
        },
        (decodedText) => {
          handleSuccessfulScan(decodedText);
        },
        () => {
          // ignore frame decode errors (expected while scanning)
        }
      );

      setIsScanning(true);
    } catch (err: unknown) {
      console.error('Camera scan error:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('Permission') || errMsg.includes('NotAllowedError')) {
        setCameraError('Izin akses kamera ditolak. Harap izinkan akses kamera pada browser Anda.');
      } else if (errMsg.includes('NotFound') || errMsg.includes('DevicesNotFoundError')) {
        setCameraError('Kamera tidak ditemukan pada perangkat Anda.');
      } else {
        setCameraError(`Gagal mengakses kamera: ${errMsg}`);
      }
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      try {
        scannerRef.current.clear();
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  // Image file scan fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCameraError(null);
      const html5QrCode = new Html5Qrcode('barcode-file-reader-dummy', false);
      const result = await html5QrCode.scanFile(file, true);
      handleSuccessfulScan(result);
      html5QrCode.clear();
    } catch (err) {
      console.error('File scan error:', err);
      setCameraError('Tidak dapat mendeteksi barcode dari gambar yang dipilih. Coba gambar lain yang lebih jelas.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Short delay to ensure modal DOM is mounted
      const timer = setTimeout(() => {
        startScanner();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={() => {
            stopScanner();
            onClose();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
          aria-label="Tutup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-4">
          <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-2">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-lg text-slate-800">Scanner Barcode Kamera</h3>
          <p className="text-xs text-slate-500">
            Arahkan kamera ke Barcode Produk atau QR Code Rak Gudang
          </p>
        </div>

        {/* Viewport Kamera */}
        <div className="relative bg-slate-950 rounded-xl min-h-[220px] flex flex-col items-center justify-center border-2 border-dashed border-blue-500 overflow-hidden mb-4">
          <div
            id="barcode-scanner-viewport"
            className="w-full h-full overflow-hidden [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
          />

          {!isScanning && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 p-4 text-center z-10">
              <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mb-2" />
              <p className="text-xs text-white font-medium">Memulai kamera...</p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4 text-center z-10">
              <AlertCircle className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs text-amber-200 font-semibold mb-3">{cameraError}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => startScanner(activeCamera || undefined)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Coba Lagi
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" /> Unggah Foto
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Kontrol Kamera Tambahan */}
        {cameras.length > 1 && (
          <div className="flex items-center justify-between text-xs mb-3 text-slate-600 bg-slate-50 p-2 rounded-lg">
            <span>Pilih Kamera:</span>
            <select
              value={activeCamera || ''}
              onChange={(e) => startScanner(e.target.value)}
              className="text-xs border rounded p-1 bg-white"
            >
              {cameras.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Upload Gambar Barcode Alternatif */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 mb-3">
          <span className="text-xs text-slate-500">Scan dari galeri / foto:</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded"
          >
            <Upload className="w-3.5 h-3.5" /> Pilih File Gambar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Input Manual */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="block text-xs font-bold text-slate-600">
            Atau Ketik Kode Barcode / Part No / Rak:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Contoh: SOC-001 atau RACK-A-01"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualInput.trim()) {
                  handleSuccessfulScan(manualInput.trim());
                  setManualInput('');
                }
              }}
              className="flex-1 p-2 border rounded-lg text-sm uppercase"
            />
            <button
              onClick={() => {
                if (manualInput.trim()) {
                  handleSuccessfulScan(manualInput.trim());
                  setManualInput('');
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs"
            >
              Cari
            </button>
          </div>
        </div>

        {/* Tombol Demo Cepat */}
        {onTestScan && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="text-slate-400 text-[10px] mb-1.5">Uji Coba Cepat (Demo):</div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  playBeep();
                  stopScanner();
                  onTestScan('SOC-001');
                }}
                className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] px-2.5 py-1 rounded font-bold"
              >
                Test SOC-001
              </button>
              <button
                onClick={() => {
                  playBeep();
                  stopScanner();
                  onTestScan('RACK-A-01');
                }}
                className="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[11px] px-2.5 py-1 rounded font-bold"
              >
                Test RACK-A-01
              </button>
            </div>
          </div>
        )}

        {/* Dummy container for file scanner */}
        <div id="barcode-file-reader-dummy" className="hidden" />
      </div>
    </div>
  );
}
