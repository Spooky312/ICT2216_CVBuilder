#!/usr/bin/env python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/../..')

from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app("development")

with app.app_context():
    admin = User.query.filter_by(email="admin@example.com").first()
    
    if not admin:
        print("❌ Admin user not found!")
        sys.exit(1)
    
    db.session.delete(admin)
    db.session.commit()
    
    print("✅ Admin deleted successfully!")
