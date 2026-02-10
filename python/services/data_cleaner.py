"""
DataCleaner - Preprocess and analyze AI vision response data.
Senior AI Developer approach: clean, categorize, and score responses for training.
"""

import re

class DataCleaner:
    # Robotic signature phrases to detect
    ROBOTIC_SIGNATURES = [
        "got it", "i understand", "i will", "done.", "ok.", "sure.",
        "no problem", "here is", "the screen", "it seems", "message box",
        "at the bottom", "i see", "certainly", "based on the image"
    ]
    
    REFUSAL_PHRASES = [
        "i'm sorry", "i cannot", "i can't", "as an ai",
        "i'm unable", "i apologize"
    ]
    
    def clean(self, responses):
        """
        Clean a batch of AI responses.
        
        Args:
            responses (list): List of raw response strings
        
        Returns:
            list: List of {original, cleaned, quality_score, issues} dicts
        """
        results = []
        for response in responses:
            cleaned = self._clean_text(response)
            score, issues = self._evaluate_quality(cleaned)
            
            results.append({
                "original": response,
                "cleaned": cleaned,
                "quality_score": score,
                "issues": issues,
                "char_count": len(cleaned),
            })
        
        return results
    
    def analyze_quality(self, responses):
        """
        Analyze quality distribution of responses for training insights.
        
        Args:
            responses (list): List of response strings
        
        Returns:
            dict: Quality analysis report
        """
        cleaned = self.clean(responses)
        total = len(cleaned)
        
        if total == 0:
            return {"total": 0, "message": "No responses to analyze"}
        
        scores = [r["quality_score"] for r in cleaned]
        avg_score = sum(scores) / total
        
        # Categorize issues
        issue_counts = {}
        for r in cleaned:
            for issue in r["issues"]:
                issue_counts[issue] = issue_counts.get(issue, 0) + 1
        
        return {
            "total": total,
            "avg_quality_score": round(avg_score, 2),
            "high_quality_count": len([s for s in scores if s >= 4]),
            "low_quality_count": len([s for s in scores if s < 3]),
            "avg_char_count": round(sum(r["char_count"] for r in cleaned) / total, 1),
            "common_issues": dict(sorted(
                issue_counts.items(), key=lambda x: x[1], reverse=True
            )[:5]),
        }
    
    def _clean_text(self, text):
        """Clean a single response text"""
        if not text:
            return ""
        
        clean = text.strip()
        
        # Remove code block markers
        clean = re.sub(r'```[a-z]*\n?', '', clean, flags=re.IGNORECASE)
        clean = clean.replace('```', '')
        
        # Remove filler phrases from start
        lower = clean.lower()
        for filler in self.ROBOTIC_SIGNATURES:
            if lower.startswith(filler):
                clean = re.sub(r'^[:\s\n\-]*', '', clean[len(filler):])
                lower = clean.lower()
        
        # Remove surrounding quotes
        clean = re.sub(r'^["\']|["\']$', '', clean).strip()
        
        return clean
    
    def _evaluate_quality(self, text):
        """
        Score response quality (1-5) and list issues.
        
        Returns:
            tuple: (score, list_of_issues)
        """
        issues = []
        score = 5  # Start perfect, deduct for issues
        
        if not text:
            return 1, ["empty_response"]
        
        # Length check
        if len(text) < 10:
            score -= 3
            issues.append("too_short")
        elif len(text) < 20:
            score -= 2
            issues.append("short")
        
        lower = text.lower()
        
        # Refusal check
        for phrase in self.REFUSAL_PHRASES:
            if phrase in lower:
                score -= 3
                issues.append("refusal")
                break
        
        # Robotic check
        for sig in self.ROBOTIC_SIGNATURES:
            if lower == sig or lower == sig + ".":
                score -= 2
                issues.append("robotic")
                break
            if lower.startswith(sig) and len(text) < 35:
                score -= 1
                issues.append("robotic_prefix")
                break
        
        return max(1, min(5, score)), issues
