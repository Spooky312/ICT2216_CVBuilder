from datetime import datetime

from app.models.resume import Resume


RESUME_CONTENT = {
    "personal": {"full_name": "Test User", "email": "test@example.com"},
    "summary": "Backend model coverage",
    "skills": ["Python", "Flask"],
}


def test_resume_to_dict_serializes_resume_and_can_omit_content(db, test_user):
    resume = Resume(
        user_id=test_user.user_id,
        title="Model Coverage Resume",
        content_json=RESUME_CONTENT,
    )
    db.session.add(resume)
    db.session.commit()

    data = resume.to_dict()
    metadata = resume.to_dict(include_content=False)

    assert data["resume_id"] == str(resume.resume_id)
    assert data["user_id"] == str(test_user.user_id)
    assert data["title"] == "Model Coverage Resume"
    assert data["template_id"] == "modern"
    assert data["content_json"] == RESUME_CONTENT
    assert data["created_at"] == resume.created_at.isoformat()
    assert data["updated_at"] == resume.updated_at.isoformat()
    assert datetime.fromisoformat(data["created_at"])
    assert datetime.fromisoformat(data["updated_at"])
    assert resume.owner == test_user

    assert metadata["resume_id"] == data["resume_id"]
    assert metadata["user_id"] == data["user_id"]
    assert "content_json" not in metadata
