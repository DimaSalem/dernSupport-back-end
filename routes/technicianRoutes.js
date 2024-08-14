import express from 'express';
import {
    technicianLogin,
    technicianLogout,
    updateAssignedRequest, 
    GetAssignedRequests,
    updateCompletedRequest
    } from "../controllers/technicianController.js";
    import { verifyToken } from "../middlewares/authMiddleware.js";

    //router.post('/login', login);

    const router = express.Router();
    router.post("/login", technicianLogin);
    router.post("/logout",verifyToken, technicianLogout);
    router.put("/assigned-request/update",verifyToken, updateAssignedRequest);
    router.put("/completed-request/update",verifyToken, updateCompletedRequest);
    router.get("/requests/assigned",verifyToken, GetAssignedRequests);

    export default router;

