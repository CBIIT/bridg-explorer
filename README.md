# BRIDG-explorer

BRIDG-explorer is an *alpha* stage GUI for learning and exploring the [BRIDG](https://bridgmodel.nci.nih.gov/) conceptual data model.

Its primary objective is to provide an open-source tool to make searching BRIDG classes, attributes, mappings and other entities intuitive and fast, and to allow users to visualize these entities in the context of the model as a whole. It is intended to help users as they create mappings from their local data models to BRIDG.

# Overview

BRIDG-explorer is browser-based. It depends on a [Neo4j](https://neo4j.com/) database containing a representation of the BRIDG model. The database, scripts to convert BRIDG XMI to Neo4j DDL statements, and [Docker](https://www.docker.com/) container support for the database are available in a [companion repository](https://github.com/CBIIT/bridg2neo).

## Features / Tutorial

BRIDG-explorer is in early days, and its features are in flux.

If you have suggestions for additional features, or find bugs, please [open an issue](https://github.com/CBIIT/bridg-explorer/issues).

* Full text search

* View documentation

* View BRIDG Class context

* Explore Associations / Create Association Paths



