import json
from pathlib import Path

import pytest

from ifc_boq.parse import parse_file
from ifc_boq.paths import FIXTURES

DUPLEX = FIXTURES / "ifc" / "Ifc2x3_Duplex_Architecture.ifc"


@pytest.fixture(scope="session")
def duplex_parsed(tmp_path_factory):
    """Parse the Duplex once per test session (about 5 s)."""
    doc, _ = parse_file(str(DUPLEX))
    return doc
