function toggleMenu(){
let menu = document.getElementById("plusMenu");

if(menu.style.display === "block"){
menu.style.display = "none";
}else{
menu.style.display = "block";
}
}

function openMenu(){
let menu = document.getElementById("sideMenu");

if(menu.style.left === "0px"){
menu.style.left = "-260px";
}else{
menu.style.left = "0px";
}
}