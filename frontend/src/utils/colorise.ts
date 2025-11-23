function pastelise(color: string, alpha = 0.25) {
  // Convert CSS color name -> hex
  const temp = document.createElement("div");
  temp.style.color = color;
  document.body.appendChild(temp);
  const rgb = getComputedStyle(temp).color;
  document.body.removeChild(temp);

  // rgb -> [r,g,b]
  const [r, g, b] = rgb.match(/\d+/g)!.map(Number);

  // Create pastel by increasing brightness + reducing opacity
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
export default pastelise;