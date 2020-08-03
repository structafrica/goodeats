// * Third Party Libraries
const mongoose = require('mongoose')
const createError = require('http-errors')
const _ = require('lodash')
const { validationResult } = require('express-validator')

// * Custom File imports
// * Async Handlers import
const asyncHandler = require('../middleware/async')
const User = require('../models/user')
const { Roles } = require('../models/user')
// * Helpers
const client = require('../../../helpers/init_redis')
const {
  SignAccessToken,
  SignRefreshToken,
  VerifyRefreshToken,
} = require('../../../helpers/jwt_helpers')
const { Capitalize } = require('../../../helpers/filters')

module.exports = {
  // * Register Method
  // * @desc Registers a new user
  // * @route /v1/auth/register
  // * @access private
  register: asyncHandler(async (req, res, next) => {
    // * Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError.UnprocessableEntity(errors.array()[0].msg)
    }

    const { email, phone, password, countyCode } = req.body
    const firstName = Capitalize(req.body.firstName)
    const lastName = Capitalize(req.body.lastName)

    // * Check if user exists
    const doesExist = await User.findOne({
      email: email,
    })
    if (doesExist)
      throw createError.Conflict(`${email} has already been registered`)

    // * Create New User
    const user = new User({
      _id: new mongoose.Types.ObjectId(),
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      password: password,
      createdAt: Date.now(),
    })
    const savedUser = await user.save()
    const accessToken = await SignAccessToken(savedUser.id, savedUser.role)
    const refreshToken = await SignRefreshToken(savedUser.id)
    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
    })
  }),
  // * Register Method
  // * @desc Registers a new admin
  // * @route /v1/auth/sa/create-admin
  // * @access private
  registerAdmin: asyncHandler(async (req, res, next) => {
    // * Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError.UnprocessableEntity(errors.array()[0].msg)
    }
    // * Check if admin exists
    const doesAdminExist = await User.adminExists()
    if (doesAdminExist) throw createError.Conflict('Admin already exists')

    const { email, phone, password } = req.body
    const firstName = Capitalize(req.body.firstName)
    const lastName = Capitalize(req.body.lastName)

    // * Check if user exists
    const doesExist = await User.findOne({
      email: email,
    })
    if (doesExist)
      throw createError.Conflict(`${email} has already been registered`)

    // * Create New User
    const user = new User({
      _id: new mongoose.Types.ObjectId(),
      firstName: firstName,
      lastName: lastName,
      email: email,
      phone: phone,
      password: password,
      role: Roles.ADMIN,
      createdAt: Date.now(),
    })

    const savedUser = await user.save()
    const accessToken = await SignAccessToken(savedUser.id, savedUser.role)
    const refreshToken = await SignRefreshToken(savedUser.id)
    res.status(201).json({
      success: true,
      accessToken,
      refreshToken,
    })
  }),
  // * Login Method
  // * @desc Logs in a user
  // * @route /v1/auth/login
  // * @access private
  login: asyncHandler(async (req, res, next) => {
    // * Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw createError.UnprocessableEntity(errors.array()[0].msg)
    }
    const { email, password } = req.body

    // * Check if user exists
    const user = await User.findOne({
      email: email,
    })
    if (!user) throw createError.NotFound('User is not registered')

    // * Compare password
    const isMatch = await user.isValidPassword(password)
    if (!isMatch)
      throw createError.Unauthorized('Username/Password is not valid')

    // * Generate tokens for valid user
    const accessToken = await SignAccessToken(user.id, user.role)
    const refreshToken = await SignRefreshToken(user.id)
    res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
    })
  }),
  // * Refresh Token Method
  // * @desc refresh user token
  // * @route /v1/auth/refresh-token
  // * @access private
  refreshToken: asyncHandler(async (req, res, next) => {
    const { refreshToken } = req.body
    if (!refreshToken) throw createError.BadRequest()
    const userId = await VerifyRefreshToken(refreshToken)
    // * Generate tokens for valid user
    const accessToken = await SignAccessToken(userId)
    const refToken = await SignRefreshToken(userId)
    res.status(200).json({
      success: true,
      accessToken: accessToken,
      refreshToken: refToken,
    })
  }),
  // * Logout Method
  // * @desc logout user
  // * @route /v1/auth/logout
  // * @access private
  logout: asyncHandler(async (req, res, next) => {
    const { refreshToken } = req.body
    if (!refreshToken) throw createError.BadRequest()
    const userId = await VerifyRefreshToken(refreshToken)
    client.DEL(userId, (err, val) => {
      if (err) {
        console.error(err.message)
        throw createError.InternalServerError()
      }
      res.status(200).json({
        success: true,
        message: 'Logout Successful',
      })
    })
  }),
}
