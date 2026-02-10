"""
PromptOptimizer - Optimizes AI system prompts based on response quality feedback.
Senior AI Developer approach: learn from response patterns to improve prompt engineering.
"""

class PromptOptimizer:
    def __init__(self):
        self.feedback_history = []
    
    def optimize(self, prompt, feedback):
        """
        Optimize the system prompt based on quality feedback.
        
        Args:
            prompt (str): Current system prompt
            feedback (list): List of {response, quality_score, context} dicts
        
        Returns:
            str: Optimized prompt with adjustments
        """
        if not feedback:
            return prompt
        
        self.feedback_history.extend(feedback)
        
        # Analyze patterns in low-quality responses
        low_quality = [f for f in feedback if f.get("quality_score", 5) < 3]
        high_quality = [f for f in feedback if f.get("quality_score", 5) >= 4]
        
        adjustments = []
        
        # If too many short responses, add length emphasis
        short_responses = [f for f in low_quality if len(f.get("response", "")) < 20]
        if len(short_responses) > len(low_quality) * 0.3:
            adjustments.append(
                "CRITICAL: Responses MUST be at least 25 characters. "
                "Write full, complete sentences."
            )
        
        # If robotic tone detected, add tone emphasis
        robotic = [f for f in low_quality if f.get("reason") == "robotic"]
        if robotic:
            adjustments.append(
                "TONE FIX: Sound like a real human texting. "
                "Use casual language, contractions, and natural phrasing."
            )
        
        # If context-irrelevant responses
        irrelevant = [f for f in low_quality if f.get("reason") == "irrelevant"]
        if irrelevant:
            adjustments.append(
                "CONTEXT FIX: Read the screen context carefully. "
                "Your response must be directly relevant to what's visible."
            )
        
        if adjustments:
            adjustment_text = "\n\n[AUTO-TUNING ADDITIONS]:\n" + "\n".join(
                f"- {a}" for a in adjustments
            )
            return prompt + adjustment_text
        
        return prompt
    
    def get_stats(self):
        """Get optimization statistics"""
        total = len(self.feedback_history)
        if total == 0:
            return {"total": 0, "avg_quality": 0}
        
        avg = sum(f.get("quality_score", 3) for f in self.feedback_history) / total
        return {
            "total": total,
            "avg_quality": round(avg, 2),
            "low_quality_count": len([f for f in self.feedback_history if f.get("quality_score", 5) < 3]),
        }
