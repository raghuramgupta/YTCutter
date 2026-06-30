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

  if (parts.length === 1) return parts;
  if (parts.length === 2) return parts * 60 + parts;
  if (parts.length === 3) return parts * 3600 + parts * 60 + parts;

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
      // user may cancel share, no need to show hard error
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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-indigo-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100">
            ✂️ Smart YouTube Clip Sharing
          </div>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">
            YouTube Clip Maker
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Load a video, choose the start and end time, and instantly share the clip.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur">
          {!isViewingSharedClip && (
            <div className="border-b border-gray-100 bg-gradient-to-r from-indigo-50 via-white to-blue-50 p-6 md:p-8">
              <label className="mb-3 block text-sm font-semibold text-gray-700">
                Paste YouTube URL
              </label>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-4 text-black shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
                <button
                  onClick={handleLoadVideo}
                  className="rounded-2xl bg-gradient-to-r from-red-600 to-pink-600 px-6 py-4 font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:shadow-xl"
                >
                  Load Video
                </button>
              </div>
            </div>
          )}

          <div className="p-6 md:p-8">
            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 shadow-sm">
                {error}
              </div>
            )}

            {videoId && (
              <>
                <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-xl">
                  <YouTube
                    videoId={videoId}
                    opts={{
                      width: "100%",
                      height: "500",
                      playerVars: {
                        autoplay: isViewingSharedClip ? 1 : 0,
                        start: safeStart,
                      },
                    }}
                    onReady={(event) => {
                      playerRef.current = event.target;
                      setPlayerReady(true);
                    }}
                  />
                </div>

                {!isViewingSharedClip ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
                        <label className="mb-2 block text-sm font-bold text-emerald-800">
                          Start Time
                        </label>
                        <input
                          type="text"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          placeholder="MM:SS or HH:MM:SS"
                          className="mb-3 w-full rounded-xl border border-emerald-200 bg-white p-3 text-black outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                        />
                        <button
                          onClick={() => captureTime("start")}
                          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-emerald-700"
                        >
                          Set Current Time as Start
                        </button>
                      </div>

                      <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
                        <label className="mb-2 block text-sm font-bold text-rose-800">
                          End Time
                        </label>
                        <input
                          type="text"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          placeholder="MM:SS or HH:MM:SS"
                          className="mb-3 w-full rounded-xl border border-rose-200 bg-white p-3 text-black outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                        />
                        <button
                          onClick={() => captureTime("end")}
                          className="w-full rounded-xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-rose-700"
                        >
                          Set Current Time as End
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 shadow-sm">
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-gray-600">
                            Selected Clip
                          </p>
                          <p className="text-xl font-bold text-gray-900">
                            {startTime} <span className="text-gray-400">→</span> {endTime}
                          </p>
                        </div>
                        <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow">
                          Ready to share
                        </div>
                      </div>

                      <button
                        onClick={handleGenerateLink}
                        className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-base font-bold text-white shadow-lg transition hover:scale-[1.01] hover:shadow-xl"
                      >
                        Generate Shareable Link
                      </button>
                    </div>

                    <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-white p-5 shadow-sm">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold text-green-800">
                          Generated Link
                        </p>
                        {copied && (
                          <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
                            Copied
                          </span>
                        )}
                      </div>

                      <input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="w-full rounded-xl border border-green-200 bg-white p-3 text-sm text-black shadow-inner"
                      />

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={handleCopyLink}
                          className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-green-700"
                        >
                          Copy Link
                        </button>

                        <button
                          onClick={handleNativeShare}
                          className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:bg-black"
                        >
                          Share
                        </button>
                      </div>

                      {generatedLink && (
                        <>
                          <div className="mt-6 border-t border-green-100 pt-5">
                            <p className="mb-3 text-sm font-semibold text-gray-700">
                              Share directly
                            </p>

                            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                              <button
                                onClick={shareToX}
                                className="rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
                              >
                                X
                              </button>

                              <button
                                onClick={shareToFacebook}
                                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                              >
                                Facebook
                              </button>

                              <button
                                onClick={shareToWhatsApp}
                                className="rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
                              >
                                WhatsApp
                              </button>

                              <button
                                onClick={shareToTelegram}
                                className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
                              >
                                Telegram
                              </button>

                              <button
                                onClick={shareToLinkedIn}
                                className="rounded-xl bg-blue-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-900"
                              >
                                LinkedIn
                              </button>

                              <button
                                onClick={shareByEmail}
                                className="rounded-xl bg-gray-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                              >
                                Email
                              </button>
                            </div>

                            <p className="mt-4 text-xs text-gray-500">
                              Instagram does not support direct web link sharing like the others.
                              For Instagram, use <span className="font-semibold">Copy Link</span> or the device's native <span className="font-semibold">Share</span> option.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-lg">
                      ▶
                    </div>
                    <p className="text-lg font-semibold text-blue-900">
                      Viewing clip from <strong>{startTime}</strong> to{" "}
                      <strong>{endTime}</strong>
                    </p>
                    <p className="mt-2 text-sm text-blue-700">
                      This video will stop automatically at the selected end time.
                    </p>
                    <button
                      onClick={() => {
                        window.location.href = "/";
                      }}
                      className="mt-5 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow transition hover:bg-blue-700"
                    >
                      Create Your Own Clip
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
