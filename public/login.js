document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
  
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        alert('Login successful!');
        // Redirect or set up session as needed.
      } else {
        // Handle 401 or other errors by showing the server message
        alert('Login failed: ' + result.error);
      }
    } catch (err) {
      console.error("Error during login:", err);
      alert('Login failed due to a network error.');
    }
  });
  
  