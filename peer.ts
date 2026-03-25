
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, X, AlertCircle } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (base64: string) => void;
  onCancel: () => void;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    startRecording();
    return () => stopRecordingCleanup();
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') 
          ? 'audio/ogg;codecs=opus' 
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("Recording stopped. Chunks count:", chunksRef.current.length);
        if (chunksRef.current.length === 0) {
          console.error("No audio chunks captured");
          setError("No audio captured. Please try again.");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mimeType });
        console.log("Blob created. Size:", blob.size, "Type:", blob.type);
        
        if (blob.size < 100) {
          console.error("Audio blob too small, likely silent or failed");
          setError("Recording failed. Please check your microphone.");
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          console.log("Base64 data generated, length:", base64data.length);
          onSend(base64data);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Recording error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Permission denied. Check browser settings.");
      } else {
        setError("Could not access microphone.");
      }
      // Wait a moment before auto-closing so user can see the error
      setTimeout(() => {
        if (!isRecording) onCancel();
      }, 3000);
    }
  };

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStop = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopRecordingCleanup();
    }
  };

  const formatDuration = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-red-900/50 border border-red-500 rounded-full animate-in fade-in duration-300">
        <AlertCircle size={20} className="text-red-400" />
        <span className="text-sm font-bold text-red-200">{error}</span>
        <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded-full transition-colors">
          <X size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[#1c1c1c] rounded-full animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-sm font-medium w-12">{formatDuration(duration)}</span>
      </div>
      <div className="flex-1 overflow-hidden h-8 flex items-center gap-1">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className="w-1 bg-gray-600 rounded-full" 
            style={{ height: `${Math.random() * 80 + 20}%` }}
          />
        ))}
      </div>
      <button onClick={onCancel} className="p-2 text-gray-400 hover:text-white transition-colors">
        <X size={20} />
      </button>
      <button 
        onClick={handleStop}
        className="p-2 bg-[#766ac8] rounded-full text-white hover:bg-[#6558b1] transition-colors"
      >
        <Send size={18} />
      </button>
    </div>
  );
};

export default VoiceRecorder;
