"""
WSGI entry point for PythonAnywhere deployment.
"""

from app import create_app

application = create_app()
