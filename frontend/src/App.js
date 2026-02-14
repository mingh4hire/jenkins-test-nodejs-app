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

function circularHueDistance(h1, h2) {
	const diff = Math.abs(h1 - h2);
	return Math.min(diff, 180 - diff);
}

function classifyColorFromHsv(h, s, v) {
	if (v >= 220 && s <= 40) {
		return { name: "White", rgb: [255, 255, 255] };
	}

	const candidates = [
		{ name: "Red", hue: 0, rgb: [255, 0, 0] },
		{ name: "Orange", hue: 15, rgb: [255, 140, 0] },
		{ name: "Green", hue: 60, rgb: [0, 255, 0] },
		{ name: "Blue", hue: 110, rgb: [0, 140, 255] }
	];

	let best = candidates[0];
	let bestScore = Infinity;
	candidates.forEach((candidate) => {
		const hueDistance = circularHueDistance(h, candidate.hue);
		const satPenalty = Math.max(0, 80 - s) * 0.3;
		const score = hueDistance + satPenalty;
		if (score < bestScore) {
			bestScore = score;
			best = candidate;
		}
	});

	return best;
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

			const roiY = Math.floor(height * 2 / 3);
			const roiHeight = height - roiY;
			const roiRect = new cv.Rect(0, roiY, width, roiHeight);
			const roi = hsv.roi(roiRect);

			const glowLower = new cv.Mat(roi.rows, roi.cols, roi.type(), [0, 80, 200, 0]);
			const glowUpper = new cv.Mat(roi.rows, roi.cols, roi.type(), [180, 255, 255, 255]);
			const glowMask = new cv.Mat();
			cv.inRange(roi, glowLower, glowUpper, glowMask);

			const coreLower = new cv.Mat(roi.rows, roi.cols, roi.type(), [0, 0, 230, 0]);
			const coreUpper = new cv.Mat(roi.rows, roi.cols, roi.type(), [180, 40, 255, 255]);
			const coreMask = new cv.Mat();
			cv.inRange(roi, coreLower, coreUpper, coreMask);

			const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
			cv.morphologyEx(glowMask, glowMask, cv.MORPH_OPEN, kernel);
			cv.morphologyEx(coreMask, coreMask, cv.MORPH_OPEN, kernel);

			const findBestCircle = (mask) => {
				const contours = new cv.MatVector();
				const hierarchy = new cv.Mat();
				cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

				let bestCircle = null;
				for (let i = 0; i < contours.size(); i += 1) {
					const contour = contours.get(i);
					const circle = cv.minEnclosingCircle(contour);
					const radius = circle.radius;
					if (radius < 2 || radius > 60) {
						contour.delete();
						continue;
					}
					if (!bestCircle || radius > bestCircle.radius) {
						bestCircle = { center: circle.center, radius };
					}
					contour.delete();
				}

				contours.delete();
				hierarchy.delete();
				return bestCircle;
			};

			let bestCircle = findBestCircle(glowMask);
			let usedGlow = true;
			if (!bestCircle) {
				bestCircle = findBestCircle(coreMask);
				usedGlow = false;
			}

			ctx.clearRect(0, 0, width, height);

			if (bestCircle) {
				const cx = Math.round(bestCircle.center.x);
				const cy = Math.round(bestCircle.center.y + roiY);
				const r = Math.round(bestCircle.radius);

				const centerX = clamp(cx, 0, width - 1);
				const centerY = clamp(cy, 0, height - 1);

				let label = "";
				let labelRgb = [255, 255, 255];

				if (usedGlow) {
					const circleMask = new cv.Mat.zeros(roi.rows, roi.cols, cv.CV_8UC1);
					cv.circle(circleMask, new cv.Point(cx, cy - roiY), r, new cv.Scalar(255), -1);
					const meanHsv = cv.mean(roi, circleMask);
					circleMask.delete();

					const [h, s, v] = meanHsv;
					const color = classifyColorFromHsv(h, s, v);
					label = color.name;
					labelRgb = color.rgb;
				} else {
					label = "White";
					labelRgb = [255, 255, 255];
				}

				const [lr, lg, lb] = labelRgb;
				const hex = rgbToHex(lr, lg, lb);

				ctx.strokeStyle = "#00FFB3";
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
				ctx.stroke();

				const textX = Math.min(centerX + r + 12, width - 160);
				const textY = Math.max(centerY - r, 28);

				ctx.font = "18px Arial";
				ctx.fillStyle = hex;
				ctx.strokeStyle = "rgba(0,0,0,0.7)";
				ctx.lineWidth = 4;
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
			kernel.delete();

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
