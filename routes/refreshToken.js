const express = require('express');
const { verifyRefreshToken, ensureAuth } = require('../validators/verifytoken');

const router= express.Router();

router.post('/refresh',verifyRefreshToken);
router.post("/verify",ensureAuth);


module.exports= router;