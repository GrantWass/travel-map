import { useCallback, useEffect, useState } from "react";

import { createTripComment, getTripComments, likeTrip, unlikeTrip } from "@/lib/api-client";
import type { Trip } from "@/lib/api-types";

interface UseTripEngagementParams {
  selectedTrip: Trip | null;
  userId: number | null;
  tripLookup: Map<number, Trip>;
  upsertTrip: (trip: Trip) => void;
  onRequireCommentAuth: () => void;
  onRequireLikeAuth: () => void;
}

interface UseTripEngagementResult {
  isCommentSubmitting: boolean;
  commentError: string | null;
  isLikeSubmitting: boolean;
  likeError: string | null;
  isTripLiked: (tripId: number) => boolean;
  handleLoadComments: () => Promise<void>;
  handleCreateComment: (body: string) => Promise<void>;
  handleToggleTripLike: () => Promise<void>;
}

export function useTripEngagement({
  selectedTrip,
  userId,
  tripLookup,
  upsertTrip,
  onRequireCommentAuth,
  onRequireLikeAuth,
}: UseTripEngagementParams): UseTripEngagementResult {
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [likedTripIds, setLikedTripIds] = useState<Set<number>>(new Set());
  const [isLikeSubmitting, setIsLikeSubmitting] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);

  useEffect(() => {
    setCommentError(null);
    setLikeError(null);
    setIsLikeSubmitting(false);
  }, [selectedTrip?.trip_id]);

  const applyTripPatch = useCallback((tripId: number, patch: Partial<Trip>) => {
    const existingTrip = tripLookup.get(tripId) ?? (selectedTrip?.trip_id === tripId ? selectedTrip : null);
    if (!existingTrip) {
      return;
    }

    upsertTrip({ ...existingTrip, ...patch });
  }, [selectedTrip, tripLookup, upsertTrip]);

  const handleLoadComments = useCallback(async () => {
    if (!selectedTrip) {
      return;
    }

    try {
      const comments = await getTripComments(selectedTrip.trip_id);
      applyTripPatch(selectedTrip.trip_id, { comments });
      setCommentError(null);
    } catch {
      setCommentError("Could not load comments right now.");
    }
  }, [applyTripPatch, selectedTrip]);

  const handleCreateComment = useCallback(async (body: string) => {
    if (!selectedTrip) {
      return;
    }
    if (userId === null) {
      onRequireCommentAuth();
      return;
    }

    setIsCommentSubmitting(true);
    setCommentError(null);
    try {
      const createdComment = await createTripComment(selectedTrip.trip_id, body);
      applyTripPatch(selectedTrip.trip_id, {
        comments: [createdComment, ...(selectedTrip.comments ?? [])],
      });
    } catch {
      setCommentError("Could not post comment right now.");
    } finally {
      setIsCommentSubmitting(false);
    }
  }, [applyTripPatch, onRequireCommentAuth, selectedTrip, userId]);

  const handleToggleTripLike = useCallback(async () => {
    if (!selectedTrip) {
      return;
    }

    if (userId === null) {
      onRequireLikeAuth();
      return;
    }

    const tripId = selectedTrip.trip_id;
    const previouslyLiked = likedTripIds.has(tripId);
    const previousLikeCount = selectedTrip.like_count ?? 0;
    const optimisticLikeCount = Math.max(previousLikeCount + (previouslyLiked ? -1 : 1), 0);

    setLikeError(null);
    setIsLikeSubmitting(true);
    setLikedTripIds((current) => {
      const next = new Set(current);
      if (previouslyLiked) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      return next;
    });
    applyTripPatch(tripId, { like_count: optimisticLikeCount });

    try {
      const result = previouslyLiked ? await unlikeTrip(tripId) : await likeTrip(tripId);
      applyTripPatch(tripId, { like_count: result.like_count });
    } catch {
      setLikedTripIds((current) => {
        const next = new Set(current);
        if (previouslyLiked) {
          next.add(tripId);
        } else {
          next.delete(tripId);
        }
        return next;
      });
      applyTripPatch(tripId, { like_count: previousLikeCount });
      setLikeError("Could not update likes right now.");
    } finally {
      setIsLikeSubmitting(false);
    }
  }, [applyTripPatch, likedTripIds, onRequireLikeAuth, selectedTrip, userId]);

  return {
    isCommentSubmitting,
    commentError,
    isLikeSubmitting,
    likeError,
    isTripLiked: (tripId: number) => likedTripIds.has(tripId),
    handleLoadComments,
    handleCreateComment,
    handleToggleTripLike,
  };
}
