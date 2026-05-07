import { asyncHandler } from '../utils/asyncHandler.js';
import { fileUrlFromFilename } from '../services/storageService.js';

/**
 * POST /api/member/uploads — multipart fields profilePhoto, idProof
 */
export const uploadMemberDocs = asyncHandler(async (req, res) => {
  const profile = req.files?.profilePhoto?.[0];
  const idProof = req.files?.idProof?.[0];
  const profilePhotoUrl = profile ? fileUrlFromFilename(profile.filename) : '';
  const idProofUrl = idProof ? fileUrlFromFilename(idProof.filename) : '';
  res.json({
    success: true,
    profilePhotoUrl,
    idProofUrl,
  });
});
