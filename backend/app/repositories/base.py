from sqlalchemy.orm import Session


class BaseRepository:
    """
    Every repository takes the request-scoped Session in its constructor
    (injected via FastAPI's Depends chain in api/deps.py) rather than
    opening its own — keeps one transaction per request.
    """

    def __init__(self, db: Session):
        self.db = db
