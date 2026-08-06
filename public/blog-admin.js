const form = document.getElementById('login-form');
const message = document.getElementById('login-message');
const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('toggle-password');

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || '请求失败，请稍后重试');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setMessage(text = '', type = '') {
  message.textContent = text;
  message.className = `form-message ${type}`.trim();
}

togglePassword.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  togglePassword.textContent = showing ? '显示' : '隐藏';
  togglePassword.setAttribute('aria-label', showing ? '显示密码' : '隐藏密码');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  setMessage();
  const button = form.querySelector('button[type="submit"]');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = '正在验证…';
  try {
    await api('/api/blogs/admin/auth', {
      method: 'POST',
      body: JSON.stringify({
        username: document.getElementById('username').value.trim(),
        password: passwordInput.value
      })
    });
    setMessage('验证成功，正在进入后台…', 'success');
    window.location.replace('/admin/dashboard');
  } catch (error) {
    setMessage(error.message, 'error');
    passwordInput.select();
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
});

api('/api/blogs/admin/auth')
  .then(status => {
    if (status.authenticated) window.location.replace('/admin/dashboard');
  })
  .catch(error => setMessage(error.message, 'error'));
