"""Seed the development database with a small, editorially labeled catalog."""

from dataclasses import dataclass

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.catalog import Genre, MediaGenre, MediaIdentifier, MediaItemRecord


@dataclass(frozen=True)
class SeedMedia:
    id: str
    title: str
    creator: str
    category: str
    genre: str
    artwork_url: str
    connection: str
    description: str
    external_provider: str | None = None
    external_id: str | None = None


CATALOG: tuple[SeedMedia, ...] = (
    SeedMedia("interstellar", "Interstellar", "Christopher Nolan", "Movies", "Sci-Fi", "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg", "Pairs cosmic scale with the intimate story of family and time.", "A science-fiction film about exploration, time, and family."),
    SeedMedia("arrival", "Arrival", "Denis Villeneuve", "Movies", "Sci-Fi", "https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg", "Connects science fiction with language, memory, and human connection.", "A reflective first-contact story."),
    SeedMedia("blade-runner-2049", "Blade Runner 2049", "Denis Villeneuve", "Movies", "Sci-Fi", "https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg", "A slow, atmospheric vision of identity and memory.", "A neo-noir science-fiction film."),
    SeedMedia("everything-everywhere", "Everything Everywhere All at Once", "Daniel Kwan & Daniel Scheinert", "Movies", "Adventure", "https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg", "Turns parallel universes into a funny, heartfelt story about family and possibility.", "A multiverse adventure with a family at its center."),
    SeedMedia("her", "Her", "Spike Jonze", "Movies", "Romance", "https://image.tmdb.org/t/p/w500/eCOtqtfvn7mxGl6nfmq4b1exJRc.jpg", "A tender near-future story about technology, loneliness, and intimacy.", "A near-future romance."),
    SeedMedia("ex-machina", "Ex Machina", "Alex Garland", "Movies", "Sci-Fi", "https://image.tmdb.org/t/p/w500/dmJW8IAKHKxFNiUnoDR7JfsK7Rp.jpg", "A precise, unsettling look at intelligence, power, and perception.", "A chamber science-fiction thriller."),
    SeedMedia("matrix", "The Matrix", "The Wachowskis", "Movies", "Sci-Fi", "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg", "A kinetic entry point for questions about reality and control.", "A cyberpunk action film."),
    SeedMedia("spider-verse", "Spider-Man: Into the Spider-Verse", "Bob Persichetti, Peter Ramsey & Rodney Rothman", "Movies", "Animation", "https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg", "Its inventive visual language makes familiar hero stories feel new.", "An animated superhero adventure."),
    SeedMedia("dune-book", "Dune", "Frank Herbert", "Books", "Science Fiction", "https://covers.openlibrary.org/b/isbn/9780441013593-L.jpg", "Uses an unfamiliar world to explore language, power, and change.", "An epic novel set on the desert planet Arrakis.", "isbn", "9780441013593"),
    SeedMedia("midnight-library", "The Midnight Library", "Matt Haig", "Books", "Fiction", "https://covers.openlibrary.org/b/isbn/9780525559474-L.jpg", "A reflective take on alternate lives and the choices between them.", "A novel about possibility and regret.", "isbn", "9780525559474"),
    SeedMedia("left-hand-darkness", "The Left Hand of Darkness", "Ursula K. Le Guin", "Books", "Science Fiction", "https://covers.openlibrary.org/b/isbn/9780441478125-L.jpg", "Thoughtful world-building that asks how culture shapes identity and belonging.", "A classic work of speculative fiction.", "isbn", "9780441478125"),
    SeedMedia("project-hail-mary", "Project Hail Mary", "Andy Weir", "Books", "Science Fiction", "https://covers.openlibrary.org/b/isbn/9780593135204-L.jpg", "A problem-solving space adventure for fans of science-led storytelling.", "A survival story set far from Earth.", "isbn", "9780593135204"),
    SeedMedia("dispossessed", "The Dispossessed", "Ursula K. Le Guin", "Books", "Science Fiction", "https://covers.openlibrary.org/b/isbn/9780061054884-L.jpg", "Pairs speculative world-building with questions about society and freedom.", "A novel about two contrasting societies.", "isbn", "9780061054884"),
    SeedMedia("parable-sower", "Parable of the Sower", "Octavia E. Butler", "Books", "Science Fiction", "https://covers.openlibrary.org/b/isbn/9781538732182-L.jpg", "A resilient, searching story about community amid change.", "A speculative novel about survival and belief.", "isbn", "9781538732182"),
    SeedMedia("piranesi", "Piranesi", "Susanna Clarke", "Books", "Fantasy", "https://covers.openlibrary.org/b/isbn/9781635575637-L.jpg", "A mysterious, meditative world for readers drawn to wonder and solitude.", "A fantastical novel set in an endless house.", "isbn", "9781635575637"),
    SeedMedia("annihilation", "Annihilation", "Jeff VanderMeer", "Books", "Science Fiction", "https://covers.openlibrary.org/b/isbn/9780374104092-L.jpg", "A strange ecological mystery with a sense of the unknowable.", "The first novel in the Southern Reach series.", "isbn", "9780374104092"),
    SeedMedia("random-access-memories", "Random Access Memories", "Daft Punk", "Music", "Electronic", "https://coverartarchive.org/release/a8308466-dd18-4912-9192-ccd0eb1878e0/front-500", "A warm, cinematic sound with a sense of expansive atmosphere.", "An electronic album with disco and rock influences."),
    SeedMedia("after-hours", "After Hours", "The Weeknd", "Music", "R&B", "https://coverartarchive.org/release/12fc7ee3-a1dc-4940-b65d-e011980ec790/front-500", "Its nocturnal, neon-lit mood evokes a cinematic city at night.", "A synth-forward R&B album."),
    SeedMedia("moon-safari", "Moon Safari", "Air", "Music", "Electronic", "https://coverartarchive.org/release/4c55906c-349b-362d-922e-956762912b42/front-500", "Dreamy, spacious electronics for listeners drawn to science-fiction soundscapes.", "A French electronic pop album."),
    SeedMedia("in-rainbows", "In Rainbows", "Radiohead", "Music", "Art Rock", "https://coverartarchive.org/release/e9b0f69e-ee3d-36ed-8c12-f8ee65f87e45/front-500", "An immersive, emotionally textured album that rewards a close listen.", "An art rock album."),
    SeedMedia("blue-train", "Blue Train", "John Coltrane", "Music", "Jazz", "https://coverartarchive.org/release/85a238df-7d38-459d-b912-3e14d953a5f2/front-500", "A focused, expressive jazz record for exploring a different immersive mood.", "A hard bop jazz album."),
    SeedMedia("kid-a", "Kid A", "Radiohead", "Music", "Electronic", "https://coverartarchive.org/release/9f30f080-dc44-3d82-8995-2345f87600f9/front-500", "Electronic textures and unease make it a strong bridge from sci-fi into music.", "An experimental rock album."),
    SeedMedia("mezzanine", "Mezzanine", "Massive Attack", "Music", "Trip Hop", "https://coverartarchive.org/release/1698a8a8-903a-39af-8df3-a1c5b8c1d20f/front-500", "Dark, layered production for listeners who like nocturnal atmosphere.", "A trip-hop album."),
    SeedMedia("jagged-little-pill", "Jagged Little Pill", "Alanis Morissette", "Music", "Alternative Rock", "https://coverartarchive.org/release/5ff897e7-a2d1-35bc-95da-b3a54714ffd6/front-500", "Direct songwriting and emotional clarity offer a different route into personal storytelling.", "An alternative rock album."),
)


def seed_catalog() -> int:
    """Insert missing seed records and return the number created."""

    inserted = 0
    with SessionLocal() as session:
        genres_by_name: dict[str, Genre] = {}
        for item in CATALOG:
            existing = session.get(MediaItemRecord, item.id)
            if existing:
                for identifier in list(existing.identifiers):
                    if identifier.provider == "tastera-seed":
                        session.delete(identifier)
                if item.external_provider and item.external_id and not any(
                    identifier.provider == item.external_provider
                    and identifier.external_id == item.external_id
                    for identifier in existing.identifiers
                ):
                    existing.identifiers.append(
                        MediaIdentifier(
                            provider=item.external_provider,
                            external_id=item.external_id,
                        )
                    )
                continue

            genre = genres_by_name.get(item.genre)
            if genre is None:
                genre = session.scalar(select(Genre).where(Genre.name == item.genre))
            if genre is None:
                genre = Genre(name=item.genre)
            genres_by_name[item.genre] = genre

            record = MediaItemRecord(
                id=item.id,
                title=item.title,
                creator=item.creator,
                category=item.category,
                primary_genre=item.genre,
                description=item.description,
                artwork_url=item.artwork_url,
                connection=item.connection,
                source="Tastera editorial seed",
                identifiers=(
                    [
                        MediaIdentifier(
                            provider=item.external_provider,
                            external_id=item.external_id,
                        )
                    ]
                    if item.external_provider and item.external_id
                    else []
                ),
                genre_links=[MediaGenre(genre=genre)],
            )
            session.add(record)
            inserted += 1

        session.commit()
    return inserted


if __name__ == "__main__":
    print(f"Seeded {seed_catalog()} catalog items.")
