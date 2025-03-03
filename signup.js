document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const name = document.getElementById('name').value;

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });
    const result = await response.json();
    if (result.success) {
      alert('Registration successful!');
    } else {
      alert('Registration failed: ' + result.error);
    }
  } catch (err) {
    console.error("Error during registration:", err);
    alert('Registration failed due to a network error.');
  }
});

