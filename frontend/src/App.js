import React, { useEffect, useRef, useState } from "react";
import "./App3.css";

const OPENCV_URL = "https://docs.opencv.org/4.x/opencv.js";

const hsvToRgb = (h, s, v) => {
	const hh = (h * 2) % 360;
	const ss = s / 255;
	const vv = v / 255;

	const c = vv * ss;
	const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
	const m = vv - c;

	let r1 = 0;
	let g1 = 0;
	let b1 = 0;

	if (hh >= 0 && hh < 60) {
		r1 = c;
		g1 = x;
	} else if (hh >= 60 && hh < 120) {
		r1 = x;
		g1 = c;
	} else if (hh >= 120 && hh < 180) {
		g1 = c;
		b1 = x;
	} else if (hh >= 180 && hh < 240) {
		g1 = x;
		b1 = c;
	} else if (hh >= 240 && hh < 300) {
		r1 = x;
		b1 = c;
	} else {
		r1 = c;
		b1 = x;
	}

	const r = Math.round((r1 + m) * 255);
	const g = Math.round((g1 + m) * 255);
	const b = Math.round((b1 + m) * 255);
	return { r, g, b };
};

const rgbToHex = ({ r, g, b }) =>
	`#${[r, g, b]
		.map((val) => val.toString(16).padStart(2, "0"))
		.join("")}`;

const App = () => {
	const videoRef = useRef(null);
	const overlayRef = useRef(null);
	const animationRef = useRef(null);
	const [cvReady, setCvReady] = useState(false);
	const [error, setError] = useState("");
	const [detectedColor, setDetectedColor] = useState(null);

	useEffect(() => {
		let cancelled = false;

		const onReady = () => {
			if (!cancelled) {
				setCvReady(true);
			}
		};

		if (window.cv && window.cv.Mat) {
			if (window.cv.onRuntimeInitialized) {
				window.cv.onRuntimeInitialized = onReady;
			} else {
				onReady();
			}
			return () => {
				cancelled = true;
			};
		}

		if (!document.getElementById("opencv-js")) {
			const script = document.createElement("script");
			script.id = "opencv-js";
			script.src = OPENCV_URL;
			script.async = true;
			script.onload = () => {
				if (window.cv) {
					window.cv.onRuntimeInitialized = onReady;
				}
			};
			script.onerror = () => {
				if (!cancelled) {
					setError("Failed to load OpenCV.");
				}
			};
			document.body.appendChild(script);
		}

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!cvReady) {
			return undefined;
		}

		let stream;
		let cleanupRequested = false;
		let processingCleanup = null;

		const startCamera = async () => {
			try {
				const constraints = {
					video: {
						facingMode: { exact: "environment" },
						width: { ideal: 1280 },
						height: { ideal: 720 },
					},
					audio: false,
				};

				try {
					stream = await navigator.mediaDevices.getUserMedia(constraints);
				} catch (err) {
					stream = await navigator.mediaDevices.getUserMedia({
						video: { facingMode: "environment" },
						audio: false,
					});
				}

				if (cleanupRequested) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				const video = videoRef.current;
				if (!video) {
					return;
				}

				video.srcObject = stream;
				await video.play();
				processingCleanup = startProcessing();
			} catch (err) {
				setError("Unable to access the rear camera.");
			}
		};

		const startProcessing = () => {
			const video = videoRef.current;
			const overlay = overlayRef.current;
			if (!video || !overlay || !window.cv) {
				return;
			}

			const { cv } = window;
			const width = video.videoWidth;
			const height = video.videoHeight;
			overlay.width = width;
			overlay.height = height;

			const cap = new cv.VideoCapture(video);
			const src = new cv.Mat(height, width, cv.CV_8UC4);
			const hsv = new cv.Mat(height, width, cv.CV_8UC3);
			const kernel = cv.getStructuringElement(
				cv.MORPH_ELLIPSE,
				new cv.Size(5, 5)
			);

			const lowerGlow = new cv.Mat(1, 1, cv.CV_8UC3, [0, 60, 120, 0]);
			const upperGlow = new cv.Mat(1, 1, cv.CV_8UC3, [179, 255, 255, 0]);
			const lowerCore = new cv.Mat(1, 1, cv.CV_8UC3, [0, 0, 200, 0]);
			const upperCore = new cv.Mat(1, 1, cv.CV_8UC3, [179, 40, 255, 0]);

			const ctx = overlay.getContext("2d");

			const processFrame = () => {
				if (cleanupRequested) {
					return;
				}

				cap.read(src);
				cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
				cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

				const yStart = Math.floor(height * 0.66);
				const roiRect = new cv.Rect(0, yStart, width, height - yStart);
				const roi = hsv.roi(roiRect);

				const glowMask = new cv.Mat();
				const coreMask = new cv.Mat();
				cv.inRange(roi, lowerGlow, upperGlow, glowMask);
				cv.inRange(roi, lowerCore, upperCore, coreMask);

				cv.morphologyEx(glowMask, glowMask, cv.MORPH_OPEN, kernel);
				cv.morphologyEx(coreMask, coreMask, cv.MORPH_OPEN, kernel);

				const findCircle = (mask) => {
					const contours = new cv.MatVector();
					const hierarchy = new cv.Mat();
					cv.findContours(
						mask,
						contours,
						hierarchy,
						cv.RETR_EXTERNAL,
						cv.CHAIN_APPROX_SIMPLE
					);

					let bestIndex = -1;
					let bestArea = 0;
					for (let i = 0; i < contours.size(); i += 1) {
						const contour = contours.get(i);
						const area = cv.contourArea(contour);
						if (area > bestArea) {
							bestArea = area;
							bestIndex = i;
						}
					}

					let best = null;
					if (bestIndex >= 0) {
						best = contours.get(bestIndex).clone();
					}

					for (let i = 0; i < contours.size(); i += 1) {
						contours.get(i).delete();
					}

					contours.delete();
					hierarchy.delete();
					return best ? { contour: best, area: bestArea } : null;
				};

				let chosen = findCircle(glowMask);
				let usedGlow = true;

				if (!chosen) {
					chosen = findCircle(coreMask);
					usedGlow = false;
				}

				ctx.clearRect(0, 0, width, height);
				ctx.lineWidth = 3;
				ctx.font = "18px Arial";

				if (chosen && chosen.area > 40) {
					const circle = cv.minEnclosingCircle(chosen.contour);
					chosen.contour.delete();

					const centerX = circle.center.x;
					const centerY = circle.center.y + yStart;
					const radius = circle.radius;

					let color = { r: 255, g: 255, b: 255 };
					if (usedGlow) {
						const mean = cv.mean(roi, glowMask);
						color = hsvToRgb(mean[0], mean[1], mean[2]);
					}

					const hex = rgbToHex(color);
					setDetectedColor(hex);

					ctx.strokeStyle = "#00e5ff";
					ctx.beginPath();
					ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
					ctx.stroke();

					const swatchX = centerX + radius + 12;
					const swatchY = centerY - 12;
					ctx.fillStyle = hex;
					ctx.fillRect(swatchX, swatchY, 24, 24);
					ctx.strokeStyle = "#ffffff";
					ctx.strokeRect(swatchX, swatchY, 24, 24);

					ctx.fillStyle = "#ffffff";
					ctx.fillText(hex.toUpperCase(), swatchX + 32, centerY + 6);
				} else {
					setDetectedColor(null);
				}

				roi.delete();
				glowMask.delete();
				coreMask.delete();

				animationRef.current = requestAnimationFrame(processFrame);
			};

			processFrame();

			return () => {
				cleanupRequested = true;
				if (animationRef.current) {
					cancelAnimationFrame(animationRef.current);
				}
				src.delete();
				hsv.delete();
				kernel.delete();
				lowerGlow.delete();
				upperGlow.delete();
				lowerCore.delete();
				upperCore.delete();
			};
		};

		startCamera();

		return () => {
			cleanupRequested = true;
			if (processingCleanup) {
				processingCleanup();
			}
			if (stream) {
				stream.getTracks().forEach((track) => track.stop());
			}
		};
	}, [cvReady]);

	return (
		<div className="app">
			{error && <div className="error">{error}</div>}
			<div className="camera-container">
				<video
					ref={videoRef}
					className="video-feed"
					playsInline
					muted
					autoPlay
				/>
				<canvas
					ref={overlayRef}
					className="video-feed"
					style={{ position: "absolute", top: 0, left: 0 }}
				/>
			</div>
			{detectedColor && (
				<div className="controls" style={{ justifyContent: "center" }}>
					<div className="zoom-controls">
						<span className="zoom-level">Detected: {detectedColor}</span>
					</div>
				</div>
			)}
		</div>
	);
};

export default App;
