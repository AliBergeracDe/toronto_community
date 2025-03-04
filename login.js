document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('https://toronto-community.onrender.com/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const result = await response.json();

    if (response.ok && result.success) {
      // Save the user's name for personalization if needed
      localStorage.setItem('userName', result.user.name);
      // Redirect to landing page
      window.location.href = 'landing.html';
    } else {
      alert('Login failed: ' + result.error);
    }
  } catch (err) {
    console.error("Error during login:", err);
    alert('Login failed due to a network error.');
  }
});
