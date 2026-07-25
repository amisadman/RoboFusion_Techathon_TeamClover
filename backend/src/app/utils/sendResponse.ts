import { Response } from "express";

export const sendResponse = <T>(
  res: Response,
  status: number,
  success: boolean,
  message?: string,
  data?: T
) => {
  return res.status(status).json({
    success: success,
    message: message,
    data: data,
  });
};
