import "./App.css";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  faPlay,
  faStepForward,
  faStepBackward,
  faPause,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";
import "firebase/compat/storage";
import "./firebaseConfig";
import img0 from "./img/0.jpg";
import img1 from "./img/1.jpeg";
import img2 from "./img/2.jpg";
import img3 from "./img/3.jpg";
import img4 from "./img/4.jpg";
import img5 from "./img/5.png";

const imgList = [img0, img1, img2, img3, img4, img5];

function formatPlaybackError(error) {
  if (!error) return "재생 중 알 수 없는 오류가 발생했습니다.";
  const name = error.name || "";
  if (name === "NotAllowedError") {
    return "브라우저가 자동 재생을 막았습니다. 재생 버튼을 눌러 주세요.";
  }
  if (name === "NotSupportedError" || name === "AbortError") {
    return "이 형식의 오디오는 재생할 수 없습니다.";
  }
  return error.message || "재생을 시작하지 못했습니다.";
}

function formatStorageError(error) {
  if (!error) return "저장소에 연결하지 못했습니다.";
  const code = error.code;
  if (code === "storage/unauthorized") {
    return "저장소 접근 권한이 없습니다.";
  }
  if (code === "storage/object-not-found") {
    return "파일을 찾을 수 없습니다.";
  }
  if (code === "storage/retry-limit-exceeded") {
    return "네트워크가 불안정합니다. 잠시 후 다시 시도해 주세요.";
  }
  return error.message || "저장소에서 데이터를 가져오지 못했습니다.";
}

function formatMediaElementError(mediaError) {
  if (!mediaError) return "오디오를 불러오지 못했습니다.";
  switch (mediaError.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return "로딩이 중단되었습니다.";
    case MediaError.MEDIA_ERR_NETWORK:
      return "네트워크 오류로 오디오를 불러오지 못했습니다.";
    case MediaError.MEDIA_ERR_DECODE:
      return "오디오 파일을 디코딩하지 못했습니다.";
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return "지원하지 않는 오디오 형식이거나 주소가 잘못되었습니다.";
    default:
      return "오디오를 재생할 수 없습니다.";
  }
}

function MusicPlayer() {
  const [indexCurr, selectIndex] = useState(null);
  const [url, setUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const progressRingRef = useRef(null);
  const audioRef = useRef(null);
  const playPauseBtnRef = useRef(null);
  const canvasRef = useRef(null);

  const [circumference, setCircumference] = useState(2 * Math.PI * 135);

  const [musicList, setMusicList] = useState([]);
  const [songName, setSongName] = useState("");
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const [btnIcon, setBtnIcon] = useState(faPlay);
  const [formattedDuration, setFormattedDuration] = useState("00:00");
  const [formattedCurrentTime, setFormattedCurrentTime] = useState("00:00");

  const [profileImg, setProfileImg] = useState(img0);
  const [playerError, setPlayerError] = useState(null);
  const mediaSourceRef = useRef(null);

  useEffect(() => {
    const fetchMusicList = async () => {
      try {
        const storageRef = firebase.storage().ref("music/");
        const result = await storageRef.listAll();
        setMusicList(result.items);
        setPlayerError(null);
      } catch (error) {
        console.error("Error fetching music list:", error);
        setPlayerError(
          `곡 목록을 불러오지 못했습니다. ${formatStorageError(error)}`
        );
      }
    };

    fetchMusicList();
  }, []);

  const updateProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      const duration = audioRef.current.duration;
      const currentTime = audioRef.current.currentTime;
      if (Number.isFinite(duration) && duration > 0) {
        const progressPercentage = currentTime / duration;
        const offset = circumference - progressPercentage * circumference;
        if (progressRingRef.current) {
          progressRingRef.current.style.strokeDashoffset = offset;
        }
      }

      requestAnimationFrame(updateProgress);
    }
  }, [circumference]);

  const startFrequencyVisualization = useCallback(() => {
    try {
      const canvas = canvasRef.current;
      const mediaEl = audioRef.current;
      if (!canvas || !mediaEl) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setPlayerError("캔버스를 초기화하지 못했습니다.");
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
      }
      const audioContext = audioContextRef.current;

      if (!analyserRef.current) {
        analyserRef.current = audioContext.createAnalyser();
      }
      const analyser = analyserRef.current;

      if (!mediaSourceRef.current) {
        mediaSourceRef.current =
          audioContext.createMediaElementSource(mediaEl);
      }
      const source = mediaSourceRef.current;

      try {
        source.disconnect();
      } catch {
        /* ignore if not connected */
      }
      try {
        analyser.disconnect();
      } catch {
        /* ignore */
      }

      source.connect(analyser);
      analyser.connect(audioContext.destination);
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      canvas.width = window.innerWidth;
      canvas.height = 200;

      const draw = () => {
        requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];
          ctx.fillStyle = "rgba(102, 178, 255, 0.8)";
          ctx.fillRect(
            x,
            canvas.height - barHeight / 2,
            barWidth,
            barHeight / 2
          );
          x += barWidth + 1;
        }
      };

      draw();
    } catch (error) {
      console.error("Frequency visualization failed:", error);
      setPlayerError(
        "주파수 시각화를 시작하지 못했습니다. 재생은 계속될 수 있습니다."
      );
    }
  }, []);

  useEffect(() => {
    const el = audioRef.current;
    if (!url || !el) return undefined;

    let cancelled = false;

    const onCanPlayThrough = () => {
      el.play()
        .then(() => {
          if (cancelled) return;
          setIsPlaying(true);
          setBtnIcon(faPause);
          setPlayerError(null);
          updateProgress();
        })
        .catch((error) => {
          if (cancelled) return;
          console.error("Audio play failed:", error);
          setPlayerError(formatPlaybackError(error));
          setIsPlaying(false);
          setBtnIcon(faPlay);
        });
    };

    try {
      el.src = url;
      el.load();
      setBtnIcon(faPlay);

      if (progressRingRef.current) {
        progressRingRef.current.style.strokeDasharray = `${circumference}`;
        progressRingRef.current.style.strokeDashoffset = `${circumference}`;
      }

      el.addEventListener("canplaythrough", onCanPlayThrough, { once: true });
      startFrequencyVisualization();
    } catch (error) {
      console.error("Failed to set audio source:", error);
      setPlayerError("오디오 소스를 설정하지 못했습니다.");
    }

    return () => {
      cancelled = true;
      el.removeEventListener("canplaythrough", onCanPlayThrough);
    };
  }, [url, circumference, updateProgress, startFrequencyVisualization]);

  useEffect(() => {
    if (audioRef.current) {
      const handleLoadedMetadata = () => {
        if (audioRef.current) {
          const duration = audioRef.current.duration;
          setFormattedDuration(formatTime(duration));
        }
      };

      const handleTimeUpdate = () => {
        if (audioRef.current) {
          const currentTime = audioRef.current.currentTime;
          setFormattedCurrentTime(formatTime(currentTime));
        }
      };

      audioRef.current.addEventListener("loadedmetadata", handleLoadedMetadata);
      audioRef.current.addEventListener("timeupdate", handleTimeUpdate);

      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener(
            "loadedmetadata",
            handleLoadedMetadata
          );
          audioRef.current.removeEventListener("timeupdate", handleTimeUpdate);
        }
      };
    }
  }, [audioRef.current]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        const ctx = audioContextRef.current;
        if (ctx && ctx.state === "suspended") {
          ctx.resume().catch((err) => {
            console.error("AudioContext resume failed:", err);
          });
        }
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setBtnIcon(faPause);
            setPlayerError(null);
            updateProgress();
          })
          .catch((error) => {
            console.error("Play failed", error);
            setPlayerError(formatPlaybackError(error));
          });
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        setBtnIcon(faPlay);
      }
    }
  };

  const selectSong = (name, idx) => {
    setPlayerError(null);
    firebase
      .storage()
      .ref("music/" + name)
      .getDownloadURL()
      .then((nextUrl) => {
        selectIndex(idx);
        setUrl(nextUrl);
        setSongName(name);
        getRandomImage();

        const bgList = [
          "linear-gradient(to right bottom, #d16ba5, #c777b9, #ba83ca, #aa8fd8, #9a9ae1, #8aa7ec, #79b3f4, #69bff8, #52cffe, #41dfff, #46eefa, #5ffbf1)",
          "linear-gradient(to right top, #051937, #004d7a, #008793, #00bf72, #a8eb12)",
          "linear-gradient(135deg, #001f3f, #4a69bd, #6a1b9a, #ff9aab)",
          "linear-gradient(to right top, #bd3939, #df6429, #f29501, #f4c900, #e2ff00)",
          "linear-gradient(to right top, #05037a, #0047b1, #007dd7, #00b1ef, #00e5ff)",
          "linear-gradient(to right top, #0057dd, #007aee, #0097f4, #00b1f1, #00c9eb, #15d6e9, #38e2e5, #59eede, #3af3ce, #2df7b7, #40fa99, #5ffb75)",
        ];
        const randomIndex = Math.floor(Math.random() * imgList.length);
        document.body.style.background = bgList[randomIndex];
      })
      .catch((error) => {
        console.error("getDownloadURL failed:", error);
        setPlayerError(
          `이 곡의 주소를 가져오지 못했습니다. ${formatStorageError(error)}`
        );
      });
  };

  const getRandomImage = () => {
    const randomIndex = Math.floor(Math.random() * imgList.length);
    setProfileImg(imgList[randomIndex]);
  };

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;

    const onAudioError = () => {
      const err = el.error;
      setPlayerError(formatMediaElementError(err));
      setIsPlaying(false);
      setBtnIcon(faPlay);
    };

    el.addEventListener("error", onAudioError);
    return () => el.removeEventListener("error", onAudioError);
  }, [url]);

  return (
    <div className="App">
      <p className="player-home-link-wrap">
        <Link className="player-home-link" to="/soap">
          CP 비누 배합표 →
        </Link>
      </p>
      {playerError ? (
        <div className="player-error-banner" role="alert">
          <p className="player-error-text">{playerError}</p>
          <button
            type="button"
            className="player-error-dismiss"
            onClick={() => setPlayerError(null)}
          >
            닫기
          </button>
        </div>
      ) : null}
      <div className="music-player-container">
        <div className="player-container">
          <div className="progress-container">
            <audio
              controls
              src={url}
              autoPlay
              ref={audioRef}
              crossOrigin="anonymous"
              style={{ display: "none" }}
              loop
            ></audio>
            <p className="timeline">
              <span>
                {formattedCurrentTime} /{" "}
                {formattedDuration ? formattedDuration : null}
              </span>
            </p>
            <svg
              className="progress-ring"
              width="300"
              height="300"
              viewBox="0 0 300 300"
            >
              <defs>
                <linearGradient
                  id="gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    style={{ stopColor: "#ff5722", stopOpacity: 1 }}
                  />
                  <stop
                    offset="100%"
                    style={{ stopColor: "#ff5722", stopOpacity: 1 }}
                  />
                </linearGradient>
                <clipPath id="circleView">
                  <circle cx="150" cy="150" r="125" />
                </clipPath>
              </defs>

              <image
                href={profileImg}
                x="25"
                y="25"
                width="250"
                height="250"
                clipPath="url(#circleView)"
                transform="rotate(90 150 150)"
                preserveAspectRatio="xMidYMid slice"
              />

              <circle
                className="progress-ring__circle-background"
                stroke="transparent"
                strokeWidth="5"
                fill="transparent"
                r="135"
                cx="150"
                cy="150"
              />

              <circle
                className="progress-ring__circle"
                ref={progressRingRef}
                stroke="rgb(255, 255, 255)"
                strokeWidth="5"
                fill="transparent"
                r="135"
                cx="150"
                cy="150"
                strokeDasharray="847"
                strokeDashoffset="847"
                transform="rotate(0 150 150)"
              />
            </svg>

            <p className="title">{songName}</p>
            <div className="button-box">
              <div className="glass-button-side">
                <button type="button">
                  <FontAwesomeIcon
                    icon={faStepBackward}
                    size="2x"
                    color="white"
                  />
                </button>
              </div>
              <div className="glass-button">
                <button
                  type="button"
                  id="playPauseBtn"
                  ref={playPauseBtnRef}
                  onClick={handlePlayPause}
                >
                  <FontAwesomeIcon icon={btnIcon} size="3x" color="white" />
                </button>
              </div>
              <div className="glass-button-side">
                <button type="button">
                  <FontAwesomeIcon
                    icon={faStepForward}
                    size="2x"
                    color="white"
                  />
                </button>
              </div>
            </div>
          </div>
          <canvas
            id="frequencyCanvas"
            ref={canvasRef}
            width="600"
            height="200"
          ></canvas>
        </div>
      </div>
      <div className="list-box">
        <ul className="song-list">
          {musicList.map((item, idx) => (
            <li
              key={idx}
              style={{ fontWeight: indexCurr === idx ? "400" : "100" }}
              onClick={() => selectSong(item.name, idx)}
            >
              <p className="song-name">{item.name}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default MusicPlayer;
