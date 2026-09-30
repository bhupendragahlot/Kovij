import { asyncHandler } from '../utils/asyncHandler.js';
import { fileRefFor } from '../services/storageService.js';

/**
 * POST /api/member/auth/uploads — multipart fields profilePhoto, idProof.
 * The photo comes back as a public URL; the ID proof as an opaque private reference.
 */
export const uploadMemberDocs = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    profilePhotoUrl: fileRefFor(req.files?.profilePhoto?.[0]),
    idProofUrl: fileRefFor(req.files?.idProof?.[0]),
  });
});
