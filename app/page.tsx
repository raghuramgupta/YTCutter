"use client";

import React, { useEffect, useRef, useState } from "react";
import YouTube from "react-youtube";

type YTPlayer = {
  getCurrentTime: () => number;
  pauseVideo: () => void;
};

const extractVideoId = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] || null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }
      if (parsed.pathname.startsWith("/embed/")) {
        return parsed.pathname.split("/embed/")[1]?.split("/")[0] || null;
      }
      if (parsed.pathname.startsWith("/shorts/")) {
        return parsed.pathname.split("/shorts/")[1]?.split("/")[0] || null;
      }
      if (parsed.pathname.startsWith("/live/")) {
        return parsed.pathname.split("/live/")[1]?.split("/")[0] || null;
      }
    }

    return null;
  } catch {
    return null;
  }
};

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return (
      String(hrs).padStart(2, "0") +
      ":" +
      String(mins).padStart(2, "0") +
      ":" +
      String(secs).padStart(2, "0")
    );
  }

  return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
};

const parseTime = (timeStr: string): number => {
  if (!timeStr) return NaN;

  const clean = String(timeStr).trim().replace(/,/g, ":");
  const parts = clean.split(":").map((p) => Number(p.trim()));

  if (parts.some((n) => Number.isNaN(n))) return NaN;

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];

  return NaN;
};

export default function Home() {
  const [inputUrl, setInputUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);

  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:10");

  const [generatedLink, setGeneratedLink] = useState("");
  const [isViewingSharedClip, setIsViewingSharedClip] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("v");
    const s = params.get("s");
    const e = params.get("e");

    if (v && s && e) {
      const start = Number(s);
      const end = Number(e);

      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        setVideoId(v);
        setStartTime(formatTime(start));
        setEndTime(formatTime(end));
        setIsViewingSharedClip(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!playerReady || !isViewingSharedClip) return;

    const endSeconds = parseTime(endTime);
    if (Number.isNaN(endSeconds)) return;

    const interval = setInterval(() => {
      if (!playerRef.current) return;

      const currentTime = playerRef.current.getCurrentTime();

      if (currentTime >= endSeconds) {
        playerRef.current.pauseVideo();
      }
    }, 300);

    return () => clearInterval(interval);
  }, [playerReady, isViewingSharedClip, endTime]);

  const handleLoadVideo = () => {
    setError("");
    setGeneratedLink("");
    setCopied(false);
    setPlayerReady(false);

    const id = extractVideoId(inputUrl);

    if (!id) {
      setVideoId(null);
      setError("Invalid YouTube URL. Please paste a valid YouTube link.");
      return;
    }

    setVideoId(id);
    setIsViewingSharedClip(false);
    setStartTime("00:00");
    setEndTime("00:10");
  };

  const captureTime = (type: "start" | "end") => {
    if (!playerRef.current) {
      setError("Player is not ready yet.");
      return;
    }

    const current = Math.floor(playerRef.current.getCurrentTime());

    if (type === "start") {
      setStartTime(formatTime(current));
    } else {
      setEndTime(formatTime(current));
    }
  };

  const handleGenerateLink = () => {
    setError("");
    setCopied(false);

    if (!videoId) {
      setError("Please load a video first.");
      return;
    }

    const s = parseTime(startTime);
    const e = parseTime(endTime);

    if (Number.isNaN(s) || Number.isNaN(e)) {
      setError("Invalid time format. Please use MM:SS or HH:MM:SS");
      return;
    }

    if (s < 0 || e < 0) {
      setError("Time cannot be negative.");
      return;
    }

    if (s >= e) {
      setError("End time must be greater than start time.");
      return;
    }

    const link =
      window.location.origin +
      "/?v=" +
      encodeURIComponent(videoId) +
      "&s=" +
      encodeURIComponent(String(s)) +
      "&e=" +
      encodeURIComponent(String(e));

    setGeneratedLink(link);
  };

  const handleCopyLink = async () => {
    if (!generatedLink) {
      setError("No link generated yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link.");
    }
  };

  const handleNativeShare = async () => {
    if (!generatedLink) {
      setError("No link generated yet.");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "YouTube Clip",
          text: `Watch this clip from \${startTime} to \${endTime}`,
          url: generatedLink,
        });
      } else {
        setError("Native sharing is not supported on this device.");
      }
    } catch {
      // user may cancel share
    }
  };

  const openShareWindow = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer,width=700,height=600");
  };

  const shareToX = () => {
    if (!generatedLink) return;
    const text = encodeURIComponent(
      `Watch this YouTube clip from \${startTime} to \${endTime}`
    );
    const url = encodeURIComponent(generatedLink);
    openShareWindow(`[https://twitter.com/intent/tweet?text=](https://twitter.com/intent/tweet?text=)\${text}&url=\${url}`);
  };

  const shareToFacebook = () => {
    if (!generatedLink) return;
    const url = encodeURIComponent(generatedLink);
    openShareWindow(`[https://www.facebook.com/sharer/sharer.php?u=](https://www.facebook.com/sharer/sharer.php?u=)\${url}`);
  };

  const shareToWhatsApp = () => {
    if (!generatedLink) return;
    const text = encodeURIComponent(
      `Watch this YouTube clip from \${startTime} to \${endTime}: \${generatedLink}`
    );
    openShareWindow(`[https://wa.me/?text=](https://wa.me/?text=)\${text}`);
  };

  const shareToTelegram = () => {
    if (!generatedLink) return;
    const text = encodeURIComponent(
      `Watch this YouTube clip from \${startTime} to \${endTime}`
    );
    const url = encodeURIComponent(generatedLink);
    openShareWindow(`[https://t.me/share/url?url=](https://t.me/share/url?url=)\${url}&text=\${text}`);
  };

  const shareToLinkedIn = () => {
    if (!generatedLink) return;
    const url = encodeURIComponent(generatedLink);
    openShareWindow(`[https://www.linkedin.com/sharing/share-offsite/?url=](https://www.linkedin.com/sharing/share-offsite/?url=)\${url}`);
  };

  const shareByEmail = () => {
    if (!generatedLink) return;
    const subject = encodeURIComponent("Check out this YouTube clip");
    const body = encodeURIComponent(
      `Watch this YouTube clip from \${startTime} to \${endTime}:\n\n\${generatedLink}`
    );
    window.location.href = `mailto:?subject=\${subject}&body=\${body}`;
  };

  const viewerStartSeconds = parseTime(startTime);
  const safeStart = Number.isNaN(viewerStartSeconds) ? 0 : viewerStartSeconds;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060816] text-white">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_30%),linear-gradient(to_bottom,rgba(255,255,255,0.02),rgba(255,255,255,0))]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8 md:px-6">
        {/* Hero */}
        <div className="mb-6 text-center sm:mb-8 md:mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-cyan-200 backdrop-blur-xl shadow-lg sm:text-sm">
            ✨ Smart YouTube Clip Sharing
          </div>

          <h1 className="mt-4 bg-gradient-to-r from-white via-cyan-200 to-fuchsia-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-5xl md:text-6xl">
            YouTube Clip Maker
          </h1>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base md:text-lg">
            Load a video, pick your perfect start and end point, and share a
            polished clip instantly.
          </p>
        </div>

        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          {!isViewingSharedClip && (
            <div className="border-b border-white/10 bg-white/5 p-4 sm:p-6 md:p-8">
              <label className="mb-3 block text-sm font-semibold text-slate-200">
                Paste YouTube URL
              </label>

              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-base text-white placeholder:text-slate-400 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-400/20 sm:py-4"
                />
                <button
                  onClick={handleLoadVideo}
                  className="rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-500 px-6 py-3 font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition active:scale-[0.98] sm:py-4 hover:brightness-110"
                >
                  Load Video
                </button>
              </div>
            </div>
          )}

          <div className="p-4 pb-24 sm:p-6 sm:pb-6 md:p-8">
            {error && (
              <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 backdrop-blur-md">
                {error}
              </div>
            )}

            {videoId && (
              <>
                <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-black/50 shadow-2xl sm:mb-8">
                  <div className="relative aspect-video w-full">
                    <YouTube
                      videoId={videoId}
                      opts={{
                        width: "100%",
                        height: "100%",
                        playerVars: {
                          autoplay: isViewingSharedClip ? 1 : 0,
                          start: safeStart,
                        },
                      }}
                      className="absolute inset-0 h-full w-full"
                      iframeClassName="h-full w-full"
                      onReady={(event) => {
                        playerRef.current = event.target;
                        setPlayerReady(true);
                      }}
                    />
                  </div>
                </div>

                {!isViewingSharedClip ? (
                  <div className="space-y-5 sm:space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-3xl border border-emerald-400/20 bg-emerald-500/10 p-4 shadow-lg backdrop-blur-xl sm:p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <label className="text-sm font-bold text-emerald-200">
                            Start Time
                          </label>
                          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                            clip begins
                          </span>
                        </div>
                        <input
                          type="text"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          placeholder="MM:SS or HH:MM:SS"
                          className="mb-3 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-base text-white placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/20"
                        />
                        <button
                          onClick={() => captureTime("start")}
                          className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-emerald-400 active:scale-[0.98]"
                        >
                          Set Current Time as Start
                        </button>
                      </div>

                      <div className="rounded-3xl border border-pink-400/20 bg-pink-500/10 p-4 shadow-lg backdrop-blur-xl sm:p-5">
                        <div className="mb-3 flex items-center justify-between">
                          <label className="text-sm font-bold text-pink-200">
                            End Time
                          </label>
                          <span className="rounded-full bg-pink-400/15 px-3 py-1 text-xs font-medium text-pink-200">
                            clip ends
                          </span>
                        </div>
                        <input
                          type="text"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          placeholder="MM:SS or HH:MM:SS"
                          className="mb-3 w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-base text-white placeholder:text-slate-400 outline-none focus:border-pink-400 focus:ring-4 focus:ring-pink-400/20"
                        />
                        <button
                          onClick={() => captureTime("end")}
                          className="w-full rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-pink-400 active:scale-[0.98]"
                        >
                          Set Current Time as End
                        </button>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5 shadow-lg backdrop-blur-xl">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-cyan-100/80">
                            Selected Clip
                          </p>
                          <p className="mt-1 text-xl font-black tracking-wide text-white sm:text-2xl">
                            {startTime} <span className="text-cyan-300">→</span> {endTime}
                          </p>
                        </div>

                        <div className="inline-flex w-fit items-center rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-cyan-200">
                          Ready to share
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateLink}
                        className="mt-4 w-full rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 py-4 text-base font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:brightness-110 active:scale-[0.99]"
                      >
                        Generate Shareable Link
                      </button>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg backdrop-blur-xl sm:p-5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-200">
                          Generated Link
                        </p>
                        {copied && (
                          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow">
                            Copied
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white outline-none"
                      />

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
                        <button
                          onClick={handleCopyLink}
                          className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400 active:scale-[0.98]"
                        >
                          Copy Link
                        </button>

                        <button
                          onClick={handleNativeShare}
                          className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 active:scale-[0.98]"
                        >
                          Share
                        </button>
                      </div>

                      {generatedLink && (
                        <div className="mt-6 border-t border-white/10 pt-5">
                          <p className="mb-3 text-sm font-semibold text-slate-200">
                            Share directly
                          </p>

                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-6">
                            <button
                              onClick={shareToX}
                              className="rounded-2xl bg-black px-3 py-3 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.97] sm:text-sm"
                            >
                              X
                            </button>

                            <button
                              onClick={shareToFacebook}
                              className="rounded-2xl bg-blue-600 px-3 py-3 text-xs font-semibold text-white transition hover:bg-blue-700 active:scale-[0.97] sm:text-sm"
                            >
                              Facebook
                            </button>

                            <button
                              onClick={shareToWhatsApp}
                              className="rounded-2xl bg-green-500 px-3 py-3 text-xs font-semibold text-white transition hover:bg-green-600 active:scale-[0.97] sm:text-sm"
                            >
                              WhatsApp
                            </button>

                            <button
                              onClick={shareToTelegram}
                              className="rounded-2xl bg-sky-500 px-3 py-3 text-xs font-semibold text-white transition hover:bg-sky-600 active:scale-[0.97] sm:text-sm"
                            >
                              Telegram
                            </button>

                            <button
                              onClick={shareToLinkedIn}
                              className="rounded-2xl bg-blue-800 px-3 py-3 text-xs font-semibold text-white transition hover:bg-blue-900 active:scale-[0.97] sm:text-sm"
                            >
                              LinkedIn
                            </button>

                            <button
                              onClick={shareByEmail}
                              className="rounded-2xl bg-slate-700 px-3 py-3 text-xs font-semibold text-white transition hover:bg-slate-600 active:scale-[0.97] sm:text-sm"
                            >
                              Email
                            </button>
                          </div>

                          <p className="mt-4 text-xs leading-5 text-slate-400">
                            Instagram doesn&apos;t support direct web link sharing like the
                            others. Use <span className="font-semibold text-white">Copy Link</span>{" "}
                            or your device&apos;s <span className="font-semibold text-white">Share</span> option.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-cyan-400/20 bg-cyan-500/10 p-5 text-center shadow-lg backdrop-blur-xl sm:p-6">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 text-2xl text-white shadow-lg">
                      ▶
                    </div>
                    <p className="text-base font-semibold text-white sm:text-lg">
                      Viewing clip from <strong>{startTime}</strong> to{" "}
                      <strong>{endTime}</strong>
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      This video will stop automatically at the selected end time.
                    </p>
                    <button
                      onClick={() => {
                        window.location.href = "/";
                      }}
                      className="mt-5 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-3 font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
                    >
                      Create Your Own Clip
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile sticky action bar */}
        {!isViewingSharedClip && videoId && (
          <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0b1020]/85 p-3 backdrop-blur-xl sm:hidden">
            <div className="mx-auto flex max-w-6xl gap-3">
              <button
                onClick={handleGenerateLink}
                className="flex-1 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-4 py-3 text-sm font-bold text-white shadow-lg"
              >
                Generate Link
              </button>
              <button
                onClick={handleCopyLink}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
