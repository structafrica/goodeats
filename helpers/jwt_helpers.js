// * Third Party Libraries
const fs = require('fs')
const path = require('path')
const jwt = require('jsonwebtoken')
const createError = require('http-errors');
// * initializations
const privateKeyPath = path.join(__dirname, "keys", "private.key");
const privateKey = fs.readFileSync(privateKeyPath, "utf8");
const publicKeyPath = path.join(__dirname, "keys", "public.key");
const publicKey = fs.readFileSync(publicKeyPath, "utf8");

module.exports = {
    SignAccessToken: (userId) => {
        const payload = {}
        const options = {
            expiresIn: "1h",
            issuer: "goodeats.com",
            audience: userId,
            algorithm: "RS256"
        }
        return new Promise ((resolve, reject) => {
            jwt.sign(payload, privateKey, options, (err, token) =>{
                if (err) {
                    console.log(err.message)
                    return reject(createError.InternalServerError())
                }
                resolve(token)
            })
        })
    },
    VerifyAccessToken: (req, res, next) => {
        // * Grab authorization token from headers
        const authHeader = req.headers['authorization']
        if (!authHeader) return next(createError.Unauthorized())
        // * Separate Bearer keyword and the access token
        const bearerToken = authHeader.split(' ')
        const token = bearerToken[1]
        console.log(token)
        // * Verify the access token
        jwt.verify(token, publicKey, (err, payload) => {
            if (err) {
                console.log(err.message)
                if (err.name === 'JsonWebTokenError'){
                    return next(createError.Unauthorized())
                }else{
                    return next(createError.Unauthorized(err.message))
                }
            }
            req.payload = payload
            next()
        })
    }
}
