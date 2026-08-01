const canvas = document.getElementById("board");

const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 800;

ctx.fillStyle = "#d8b36a";
ctx.fillRect(0,0,800,800);

ctx.fillStyle="black";
ctx.font="40px Arial";
ctx.fillText("Snake & Ladders Deluxe",120,400);
