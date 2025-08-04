function showDate() {
  
  document.getElementById('demo').innerHTML = new Date() + "<br>You entered: " + a;
}
alert("hello world");
  console.log("yo yo ");
  let a = prompt("Enter your number");

  const crypto = require('crypto');

// Create a SHA-256 hash of a string
const hash = crypto.createHash('sha256')
  .update('Hello, Node.js!')
  .digest('hex');
console.log('SHA-256 Hash:', hash);