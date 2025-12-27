const sendResponse = require('../utils/response');
const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');

const createRegistrationUploadUrl = catchAsync(async (req, res) => {
    const signedUpload = await authService.createRegistrationUploadUrl(req.body);
    sendResponse(res, 201, signedUpload, 'Signed upload URL generated');
});

const register = catchAsync(async (req, res) => {
    const result = await authService.register(req.body);
    sendResponse(res, 201, result, 'Registration submitted successfully');
});

const login = catchAsync(async (req, res) => {
    const result = await authService.login(req.body);
    sendResponse(res, 200, result, 'Login successful');
});

const adminLogin = catchAsync(async (req, res) => {
    const result = await authService.adminLogin(req.body);
    sendResponse(res, 200, result, 'Admin login successful');
});

const forgotPassword = catchAsync(async (req, res) => {
    await authService.forgotPassword({
        email: req.body.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
    });
    const payload = { message: 'If the email exists, instructions were sent.' };
    sendResponse(res, 200, payload, payload.message);
});

const resendForgotPasswordOtp = catchAsync(async (req, res) => {
    const result = await authService.resendForgotPasswordOtp({
        email: req.body.email,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
    });
    sendResponse(res, 200, result, result.message);
});

const resetPassword = catchAsync(async (req, res) => {
    await authService.resetPassword({
        email: req.body.email,
        otp: req.body.otp,
        password: req.body.password,
        ipAddress: req.ip,
    });
    const payload = { message: 'Password updated successfully.' };
    sendResponse(res, 200, payload, payload.message);
});

const verifyOtp = catchAsync(async (req, res) => {
    const result = await authService.verifyOtp({
        email: req.body.email,
        otp: req.body.otp,
        ipAddress: req.ip,
    });
    sendResponse(res, 200, result, result.message);
});

const escapeHtml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/>/g, '&gt;')
        .replace(/</g, '&lt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

const buildVerificationPage = ({ title, message, variant }) => {
    const colors = {
        success: { bg: '#0f1f3d', accent: '#1c3a70' },
        info: { bg: '#0f1f3d', accent: '#1c3a70' },
    };
    const palette = colors[variant] || colors.info;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
            color: #fff;
            background-color: #050b18;
        }
        body {
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at top, ${palette.accent}, #050b18 55%);
        }
        .card {
            width: min(520px, 90vw);
            padding: 3rem;
            border-radius: 28px;
            background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0));
            backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 25px 60px rgba(4, 7, 18, 0.7);
            text-align: center;
        }
        .logo {
            width: 130px;
            height: 130px;
            margin: 0 auto 1.25rem;
            border-radius: 50%;
            background: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 30px rgba(15, 31, 61, 0.3);
        }
        .logo svg {
            width: 80px;
            height: 80px;
            fill: #0d1b3b;
        }
        h1 {
            margin: 0 0 0.75rem;
            font-size: clamp(1.8rem, 4vw, 2.2rem);
            letter-spacing: 1px;
        }
        p {
            margin: 0;
            color: rgba(255, 255, 255, 0.85);
            line-height: 1.6;
        }
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-bottom: 1rem;
            padding: 0.35rem 1rem;
            border-radius: 999px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">
            <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M51.6 49.4l-22.6 9.3-12.3-23.2 16.8-41.2h32v27z"/><path d="M11 57.7l-8.4 4.7 12.7-42.4 24.4-10.3z" opacity="0.15"/></svg>
        </div>
        <div class="badge">${variant === 'success' ? 'Verified' : 'Notice'}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message)}</p>
    </div>
</body>
</html>`;
};

const verifyEmail = catchAsync(async (req, res) => {
    const result = await authService.verifyEmail({
        email: req.query.email,
        token: req.query.token,
    });
    const html = buildVerificationPage({
        title: 'Email verified',
        message: result.message || 'Your email is now confirmed. You can close this window.',
        variant: 'success',
    });
    res.status(200).header('Content-Type', 'text/html').send(html);
});

const resendVerificationEmail = catchAsync(async (req, res) => {
    const result = await authService.resendVerificationEmail({
        email: req.body.email,
    });
    sendResponse(res, 200, result, result.message);
});

module.exports = {
    createRegistrationUploadUrl,
    register,
    login,
    adminLogin,
    forgotPassword,
    resendForgotPasswordOtp,
    verifyOtp,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
};
