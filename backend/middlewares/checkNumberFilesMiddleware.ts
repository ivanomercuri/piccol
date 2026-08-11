import { Request, Response, NextFunction } from 'express';

export = function checkNumberFiles(
  field: string,
  max: number | null,
  customMessage: string | null = null
) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.validationErrors = req.validationErrors || [];
    // Cast: vedi validateProductImageMiddleware.ts per lo stesso motivo —
    // questa route usa sempre uploadImage.array(...), quindi req.files è
    // sempre un array a runtime anche se @types/multer lo tipizza più
    // largo (array o dizionario, a seconda del metodo Multer usato).
    const files = (req.files || []) as Express.Multer.File[];
    const count = files.filter((f) => f.fieldname === field).length;

    if (max !== null && count > max) {
      req.validationErrors.push({
        msg: customMessage || `Caricare al massimo ${max} file`,
        path: field,
      });
    }
    next();
  };
};