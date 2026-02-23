"""Management command to seed the database with places."""
from django.core.management.base import BaseCommand
from seed.places import seed


class Command(BaseCommand):
    help = 'Seed the database with sample places data'

    def handle(self, *args, **options):
        self.stdout.write('Seeding places...')
        seed()
        self.stdout.write(self.style.SUCCESS('Done!'))
