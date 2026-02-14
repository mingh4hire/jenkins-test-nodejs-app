import React, { useEffect, useRef, useState } from "react";
import "./App3.css";

const OPENCV_SRC = "https://docs.opencv.org/4.x/opencv.js";

function loadOpenCv() {
  return new Promise((resolve, reject) => {
    if (window.cv && window.cv.Mat) {
      resolve(window.cv);
      return;
    }

    const existing = document.querySelector(`script[src="${OPENCV_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.cv));
      existing.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");
    script.src = OPENCV_SRC;
    script.async = true;
    script.onload = () => resolve(window.cv);
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function App() {
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const rafRef = useRef(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    let isMounted = true;

    const startCamera = async () => {
      try {
        const constraints = {
          audio: false,
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          // fallback if exact constraint fails
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: "environment" }
          });
        }

        if (!isMounted) return;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
      } catch (err) {
        setError("Camera access failed. Please allow camera permissions.");
      }
    };

    const init = async () => {
      await loadOpenCv();
      if (!isMounted) return;
      await startCamera();
      setReady(true);
    };

    init();

    return () => {
      isMounted = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!window.cv || !window.cv.Mat) return;

    const cv = window.cv;
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    const ctx = overlay.getContext("2d");

    const processFrame = () => {
      if (video.readyState < 2) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (width === 0 || height === 0) {
        rafRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (overlay.width !== width || overlay.height !== height) {
        overlay.width = width;
        overlay.height = height;
      }

      const frame = new cv.Mat(height, width, cv.CV_8UC4);
      const cap = new cv.VideoCapture(video);
      cap.read(frame);

      const hsv = new cv.Mat();
      cv.cvtColor(frame, hsv, cv.COLOR_RGBA2RGB);
      cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

      // Focus on bottom third of the frame
      const roiY = Math.floor(height * 2 / 3);
      const roiHeight = height - roiY;
      const roiRect = new cv.Rect(0, roiY, width, roiHeight);
      const roi = hsv.roi(roiRect);

      // Glow mask: bright and saturated
      const glowLower = new cv.Mat(roi.rows, roi.cols, roi.type(), [0, 80, 200, 0]);
      const glowUpper = new cv.Mat(roi.rows, roi.cols, roi.type(), [180, 255, 255, 255]);
      const glowMask = new cv.Mat();
      cv.inRange(roi, glowLower, glowUpper, glowMask);

      // White core mask: low saturation, very high value
      const coreLower = new cv.Mat(roi.rows, roi.cols, roi.type(), [0, 0, 230, 0]);
      const coreUpper = new cv.Mat(roi.rows, roi.cols, roi.type(), [180, 50, 255, 255]);
      const coreMask = new cv.Mat();
      cv.inRange(roi, coreLower, coreUpper, coreMask);

      const combined = new cv.Mat();
      cv.bitwise_or(glowMask, coreMask, combined);

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(combined, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let bestCircle = null;
      for (let i = 0; i < contours.size(); i += 1) {
        const contour = contours.get(i);
        const circle = cv.minEnclosingCircle(contour);
        const radius = circle.radius;
        if (radius < 2 || radius > 40) {
          contour.delete();
          continue;
        }
        if (!bestCircle || radius > bestCircle.radius) {
          bestCircle = { center: circle.center, radius };
        }
        contour.delete();
      }

      ctx.clearRect(0, 0, width, height);

      if (bestCircle) {
        const cx = Math.round(bestCircle.center.x);
        const cy = Math.round(bestCircle.center.y + roiY);
        const r = Math.round(bestCircle.radius);

        const centerX = clamp(cx, 0, width - 1);
        const centerY = clamp(cy, 0, height - 1);

        const pixel = frame.ucharPtr(centerY, centerX);
        const b = pixel[0];
        const g = pixel[1];
        const rVal = pixel[2];
        const hex = rgbToHex(rVal, g, b);

        ctx.strokeStyle = "#00FFB3";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        const label = `${hex}`;
        ctx.font = "18px Arial";
        ctx.fillStyle = hex;
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 4;
        const textX = Math.min(centerX + r + 10, width - 120);
        const textY = Math.max(centerY - r, 20);
        ctx.strokeText(label, textX, textY);
        ctx.fillText(label, textX, textY);

        ctx.fillStyle = hex;
        ctx.beginPath();
        ctx.arc(textX - 12, textY - 6, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      frame.delete();
      hsv.delete();
      roi.delete();
      glowLower.delete();
      glowUpper.delete();
      glowMask.delete();
      coreLower.delete();
      coreUpper.delete();
      coreMask.delete();
      combined.delete();
      contours.delete();
      hierarchy.delete();

      rafRef.current = requestAnimationFrame(processFrame);
    };

    rafRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [ready]);

  return (
    <div className="app">
      {error && <div className="error">{error}</div>}
      <div className="camera-container">
        <video ref={videoRef} className="video-feed" playsInline muted />
        <canvas ref={overlayRef} className="video-feed" />
      </div>
    </div>
  );
}
