// FrequencyVisualizer.js
import React, { useEffect, useRef } from 'react';

const FrequencyVisualizer = ({ frequencies }) => {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!canvas || !ctx) {
            console.error('Canvas or context not available');
            return;
        }

        canvas.width = 800;
        canvas.height = 200;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (frequencies && frequencies.length > 0) {
                const barWidth = (canvas.width / frequencies.length) || 0;
                let x = 0;

                frequencies.forEach((frequency, index) => {
                    const barHeight = frequency * canvas.height;

                    // Draw the bar with gradient
                    const gradient = ctx.createLinearGradient(x, canvas.height - barHeight, x, canvas.height);
                    gradient.addColorStop(0, 'gold');     // Starting color
                    gradient.addColorStop(1, 'orangered'); // Ending color
                    ctx.fillStyle = gradient;

                    // Draw rounded bars
                    const barX = x;
                    const barY = canvas.height - barHeight;
                    const barRadius = barWidth / 2; // Radius for rounded corners

                    ctx.beginPath();
                    ctx.moveTo(barX + barRadius, barY);
                    ctx.lineTo(barX + barWidth - barRadius, barY);
                    ctx.arcTo(barX + barWidth, barY, barX + barWidth, barY + barRadius, barRadius); // Top-right corner
                    ctx.lineTo(barX + barWidth, canvas.height - 0); // Corrected: bottom of canvas
                    ctx.lineTo(barX, canvas.height - 0); // Corrected: bottom of canvas
                    ctx.lineTo(barX, barY + barRadius);
                    ctx.arcTo(barX, barY, barX + barRadius, barY, barRadius); // Top-left corner
                    ctx.closePath();
                    ctx.fill();

                    x += barWidth;
                });
            }

            animationFrameRef.current = requestAnimationFrame(draw);
        };

        animationFrameRef.current = requestAnimationFrame(draw);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [frequencies]);

    return (
        <canvas ref={canvasRef} style={{ width: '100%', height: '200px', backgroundColor: '#333' }} />
    );
};

export default FrequencyVisualizer;
