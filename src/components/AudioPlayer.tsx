"use client";

import Image from "next/image";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Episode } from "@/lib/episodes";
import { HOST, coverFor } from "@/lib/constants";
import Icon from "./Icon";

export default function AudioPlayer({ ep }: { ep: Episode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const fmt = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [playing]);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    audio.currentTime = ratio * duration;
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  const seekKeyboard = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") skip(5);
    else if (e.key === "ArrowLeft") skip(-5);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div className="player">
      {ep.audioUrl && <audio ref={audioRef} src={ep.audioUrl} preload="metadata" />}
      <div className="player-top">
        <div className="player-art">
          {ep.image?.startsWith("http") ? (
            <Image src={ep.image} alt="" width={72} height={72} style={{ objectFit: "cover" }} />
          ) : (
            <img src={ep.image || coverFor(ep.n)} alt="" />
          )}
        </div>
        <div className="player-info">
          <p className="eyebrow on-dark" style={{ margin: 0 }}>
            Episode {ep.n}
            {ep.guest ? ` · ${ep.guest}` : ""}
          </p>
          <div className="t">{ep.title}</div>
          <div className="s">House of Track · with {HOST}</div>
        </div>
      </div>
      <div className="player-controls">
        <button className="pc-btn" onClick={() => skip(-15)} aria-label="Back 15 seconds">
          <Icon name="back15" size={22} />
        </button>
        <button
          className="pc-play"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
        >
          <Icon name={playing ? "pause" : "play"} size={22} />
        </button>
        <button className="pc-btn" onClick={() => skip(15)} aria-label="Forward 15 seconds">
          <Icon name="fwd15" size={22} />
        </button>
        <div className="scrub">
          <span className="time">{fmt(currentTime)}</span>
          <div
            className="track"
            onClick={seek}
            onKeyDown={seekKeyboard}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuenow={Math.round(currentTime)}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuetext={`${fmt(currentTime)} of ${duration > 0 ? fmt(duration) : "unknown"}`}
          >
            <div className="track-fill" style={{ width: pct + "%" }} />
            <div className="track-knob" style={{ left: pct + "%" }} />
          </div>
          <span className="time">{duration > 0 ? fmt(duration) : "--:--"}</span>
        </div>
      </div>
    </div>
  );
}
