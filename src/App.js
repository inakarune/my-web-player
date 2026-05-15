import "./App.css";
import React, { useState, useEffect, useRef } from "react";
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
import firebaseConfig from "./firebaseConfig";
import img0 from "./img/0.jpg";
import img1 from "./img/1.jpeg";
import img2 from "./img/2.jpg";
import img3 from "./img/3.jpg";
import img4 from "./img/4.jpg";
import img5 from "./img/5.png";

const imgList = [img0, img1, img2, img3, img4, img5];

function App() {
  const [audio] = useState(new Audio());
  const [indexCurr, selectIndex] = useState(null);
  const [url, setUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const progressRingRef = useRef(null);
  const audioRef = useRef(null);
  const playPauseBtnRef = useRef(null);
  const canvasRef = useRef(null);

  const [circumference, setCircumference] = useState(2 * Math.PI * 135); // 90 is the radius of the circle

  const [musicList, setMusicList] = useState([]);
  const [songName, setSongName] = useState("");
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const [btnIcon, setBtnIcon] = useState(faPlay);
  const [formattedDuration, setFormattedDuration] = useState("00:00");
  const [formattedCurrentTime, setFormattedCurrentTime] = useState("00:00");

  const [profileImg, setProfileImg] = useState(img0);

  useEffect(() => {
    const fetchMusicList = async () => {
      try {
        const storageRef = firebase.storage().ref("music/");
        const result = await storageRef.listAll();
        setMusicList(result.items);
      } catch (error) {
        console.error("Error fetching music list:", error);
      }
    };

    fetchMusicList();
  }, []);

  useEffect(() => {
    const setAudioSource = async () => {
      if (url) {
        try {
          if (audioRef.current) {
            audioRef.current.src = url;
            audioRef.current.load();
            setBtnIcon(faPlay);

            // Set initial progress ring state
            if (progressRingRef.current) {
              progressRingRef.current.style.strokeDasharray = `${circumference}`;
              progressRingRef.current.style.strokeDashoffset = `${circumference}`;
            }

            audioRef.current.oncanplaythrough = () => {
              try {
                audioRef.current.play();
                setIsPlaying(true);
                setBtnIcon(faPause);
                updateProgress();
              } catch (error) {
                console.error("Audio play failed:", error);
              }
            };

            startFrequencyVisualization();
          }
        } catch (error) {
          console.error("Failed to set audio source:", error);
        }
      }
    };

    setAudioSource();
  }, [url, circumference]);

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
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setBtnIcon(faPause);
            updateProgress();
          })
          .catch((error) => {
            console.error("Play failed", error);
          });
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
        setBtnIcon(faPlay);
      }
    }
  };

  const updateProgress = () => {
    if (audioRef.current && !audioRef.current.paused) {
      const duration = audioRef.current.duration;
      const currentTime = audioRef.current.currentTime;
      const progressPercentage = currentTime / duration;
      const offset = circumference - progressPercentage * circumference;
      if (progressRingRef.current) {
        progressRingRef.current.style.strokeDashoffset = offset;
      }

      requestAnimationFrame(updateProgress);
    }
  };

  const startFrequencyVisualization = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Create or reuse AudioContext and AnalyserNode
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    const audioContext = audioContextRef.current;

    // Disconnect previous source if it exists
    if (analyserRef.current) {
      const previousSource = analyserRef.current._source;
      if (previousSource) {
        previousSource.disconnect();
      }
    }

    // Create a new AnalyserNode
    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
    }
    const analyser = analyserRef.current;

    // Create new MediaElementSourceNode
    const source = audioContext.createMediaElementSource(audioRef.current);

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
        ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);
        x += barWidth + 1;
      }
    };

    draw();
  };

  const selectSong = (name, idx) => {
    firebase
      .storage()
      .ref("music/" + name)
      .getDownloadURL()
      .then((url) => {
        selectIndex(idx);
        setUrl(url);
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
      });
  };

  const getRandomImage = () => {
    const randomIndex = Math.floor(Math.random() * imgList.length);
    setProfileImg(imgList[randomIndex]);
  };

  return (
    <div className="App">
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
                  <circle cx="150" cy="150" r="125" />{" "}
                  {/* 원의 반지름도 조정 */}
                </clipPath>
              </defs>

              {/* 이미지 */}
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

              {/* 배경 원 */}
              <circle
                className="progress-ring__circle-background"
                stroke="transparent"
                strokeWidth="5"
                fill="transparent"
                r="135"
                cx="150"
                cy="150"
              />

              {/* 진행 바 */}
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
                <button>
                  <FontAwesomeIcon
                    icon={faStepBackward}
                    size="2x"
                    color="white"
                  />
                </button>
              </div>
              <div className="glass-button">
                <button
                  id="playPauseBtn"
                  ref={playPauseBtnRef}
                  onClick={handlePlayPause}
                >
                  <FontAwesomeIcon icon={btnIcon} size="3x" color="white" />
                </button>
              </div>
              <div className="glass-button-side">
                <button>
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

export default App;
