function pastelise(color: string, alpha = 0.25) {
  // Chuyển CSS color name -> hex
  const temp = document.createElement("div");
  temp.style.color = color;
  document.body.appendChild(temp);
  const rgb = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // rgb -> [r,g,b]
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);

  // pastel bằng cách tăng sáng + giảm opacity
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
export default pastelise;