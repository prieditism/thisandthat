const button = document.querySelector('#button');

button.addEventListener('click', () => {
    // create a random hex color
    const randomColor = Math.floor(Math.random() * 16777215).toString(16);
    console.log(randomColor);
    // change the background color
    document.body.style.backgroundColor = '#' + randomColor;

    // rotate the button by some random degrees
    const randomDeg = Math.floor(Math.random() * 360);
    button.style.transform = `rotate(${randomDeg}deg)`;


});